// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAaveV3Pool { function flashLoanSimple(address,address,uint256,bytes calldata,uint16) external; }
interface IBalancerVault { function flashLoan(address,address[] calldata,uint256[] calldata,bytes calldata) external; }
interface IERC20Like { function balanceOf(address) external view returns(uint256); }

contract AegisFlashLoanExecutor is EIP712,Ownable,ReentrancyGuard,Pausable {
 using SafeERC20 for IERC20;
 error UnauthorizedRelayer(); error InvalidSignature(); error DeadlineExpired(); error TargetBlockMismatch();
 error NonceUsed(); error InvalidRoute(); error TargetNotAllowed(); error SelectorNotAllowed();
 error InvalidAmount(); error InvalidCaller(); error InvalidRecipient(); error ValueNotAllowed();
 error ProfitInvariantFailed(uint256,uint256); error RescueOnlyPaused(); error ZeroAddress();
 bytes32 private constant EXECUTION_TYPEHASH=keccak256("Execution(address asset,uint256 amount,uint256 minProfit,uint256 relayerFeeCap,address relayer,address feeRecipient,uint256 nonce,uint256 deadline,uint256 targetBlock,bytes32 routeHash)");
 struct Execution {address asset;uint256 amount;uint256 minProfit;uint256 relayerFeeCap;address relayer;address feeRecipient;uint256 nonce;uint256 deadline;uint256 targetBlock;bytes32 routeHash;}
 struct Call {address target;uint256 value;bytes data;}
 struct Approval {address token;address spender;uint256 amount;}
 IAaveV3Pool public immutable AAVE_POOL; IBalancerVault public immutable BALANCER_VAULT;
 mapping(address=>bool) public authorizedRelayers; mapping(address=>bool) public authorizedSigners;
 mapping(address=>bool) public targetWhitelist; mapping(address=>mapping(bytes4=>bool)) public selectorWhitelist;
 mapping(uint256=>bool) public usedNonces;
 bool private active; address private asset; uint256 private principal; uint256 private baseline; bytes32 private routeHash;
 event ExecutionCompleted(uint256 indexed nonce,uint256 profit,uint256 premium,uint256 relayerFeeCap);
 event EmergencyTokenRescue(address indexed token,address indexed to,uint256 amount);
 constructor(address aave,address balancer,address owner_) EIP712("AegisEngine","1") Ownable(owner_) {
  if(aave==address(0)||balancer==address(0)||owner_==address(0)) revert ZeroAddress();
  AAVE_POOL=IAaveV3Pool(aave); BALANCER_VAULT=IBalancerVault(balancer);
  authorizedRelayers[owner_]=true; authorizedSigners[owner_]=true;
 }
 modifier onlyRelayer(){if(!authorizedRelayers[msg.sender])revert UnauthorizedRelayer();_;} modifier onlyActive(){if(!active)revert InvalidCaller();_;}
 function setRelayer(address a,bool v) external onlyOwner {if(a==address(0))revert ZeroAddress();authorizedRelayers[a]=v;}
 function setSigner(address a,bool v) external onlyOwner {if(a==address(0))revert ZeroAddress();authorizedSigners[a]=v;}
 function setTarget(address a,bool v) external onlyOwner {if(a==address(0))revert ZeroAddress();targetWhitelist[a]=v;}
 function setSelector(address a,bytes4 s,bool v) external onlyOwner {if(a==address(0))revert ZeroAddress();selectorWhitelist[a][s]=v;}
 function pause() external onlyOwner {_pause();} function unpause() external onlyOwner {_unpause();}
 function executeFlashLoan(Execution calldata e,Call[] calldata c,Approval[] calldata a,bytes calldata sig) external nonReentrant whenNotPaused onlyRelayer {
  _validate(e,c,a,sig); usedNonces[e.nonce]=true; active=true;asset=e.asset;principal=e.amount;baseline=IERC20Like(e.asset).balanceOf(address(this));routeHash=e.routeHash;
  AAVE_POOL.flashLoanSimple(address(this),e.asset,e.amount,abi.encode(e,c,a),0); _clear();
 }
 function _validate(Execution calldata e,Call[] calldata c,Approval[] calldata a,bytes calldata sig) internal view {
  if(e.asset==address(0)||e.amount==0)revert InvalidAmount(); if(e.relayer!=msg.sender||e.feeRecipient!=msg.sender)revert InvalidRecipient();
  if(e.deadline<block.timestamp)revert DeadlineExpired(); if(e.targetBlock!=block.number)revert TargetBlockMismatch(); if(usedNonces[e.nonce])revert NonceUsed();
  if(keccak256(abi.encode(c,a))!=e.routeHash)revert InvalidRoute();
  bytes32 h=_hashTypedDataV4(keccak256(abi.encode(EXECUTION_TYPEHASH,e.asset,e.amount,e.minProfit,e.relayerFeeCap,e.relayer,e.feeRecipient,e.nonce,e.deadline,e.targetBlock,e.routeHash)));
  if(!authorizedSigners[ECDSA.recover(h,sig)])revert InvalidSignature();
 }
 function executeOperation(address a,uint256 amount,uint256 premium,address initiator,bytes calldata p) external onlyActive returns(bool){
  if(msg.sender!=address(AAVE_POOL)||initiator!=address(this)||a!=asset||amount!=principal)revert InvalidCaller();
  (Execution memory e,Call[] memory c,Approval[] memory ap)=abi.decode(p,(Execution,Call[],Approval[]));
  _run(ap,c); uint256 bal=IERC20Like(a).balanceOf(address(this)); uint256 req=baseline+amount+premium+e.relayerFeeCap+e.minProfit;
  if(bal<req)revert ProfitInvariantFailed(req,bal); if(e.relayerFeeCap>0)IERC20(a).safeTransfer(e.feeRecipient,e.relayerFeeCap);
  IERC20(a).forceApprove(address(AAVE_POOL),amount+premium); uint256 post=IERC20Like(a).balanceOf(address(this));
  uint256 reqPost=baseline+amount+premium+e.minProfit; if(post<reqPost)revert ProfitInvariantFailed(reqPost,post);
  emit ExecutionCompleted(e.nonce,post-baseline-amount-premium,premium,e.relayerFeeCap); return true;
 }
 function receiveFlashLoan(address[] calldata t,uint256[] calldata amounts,uint256[] calldata fees,bytes calldata p) external onlyActive {
  if(msg.sender!=address(BALANCER_VAULT)||t.length!=1||amounts.length!=1||fees.length!=1||t[0]!=asset||amounts[0]!=principal)revert InvalidCaller();
  (Execution memory e,Call[] memory c,Approval[] memory ap)=abi.decode(p,(Execution,Call[],Approval[])); _run(ap,c);
  uint256 bal=IERC20Like(asset).balanceOf(address(this)); uint256 req=baseline+principal+fees[0]+e.relayerFeeCap+e.minProfit;
  if(bal<req)revert ProfitInvariantFailed(req,bal); if(e.relayerFeeCap>0)IERC20(asset).safeTransfer(e.feeRecipient,e.relayerFeeCap);
  IERC20(asset).safeTransfer(address(BALANCER_VAULT),principal+fees[0]); uint256 post=IERC20Like(asset).balanceOf(address(this));
  uint256 reqPost=baseline+e.minProfit; if(post<reqPost)revert ProfitInvariantFailed(reqPost,post);
  emit ExecutionCompleted(e.nonce,post-baseline,fees[0],e.relayerFeeCap);
 }
 function _run(Approval[] memory ap,Call[] memory c) internal {
  for(uint i;i<ap.length;i++){if(!targetWhitelist[ap[i].spender])revert TargetNotAllowed();IERC20(ap[i].token).forceApprove(ap[i].spender,ap[i].amount);}
  for(uint i;i<c.length;i++){if(!targetWhitelist[c[i].target])revert TargetNotAllowed();if(c[i].value!=0)revert ValueNotAllowed();if(c[i].data.length<4)revert InvalidRoute();
   bytes4 s;assembly{s:=mload(add(c[i].data,32))}if(!selectorWhitelist[c[i].target][s])revert SelectorNotAllowed();(bool ok,bytes memory r)=c[i].target.call(c[i].data);if(!ok)assembly{revert(add(r,32),mload(r))}
  }
  for(uint i;i<ap.length;i++)IERC20(ap[i].token).forceApprove(ap[i].spender,0);
 }
 function _clear() internal {active=false;asset=address(0);principal=0;baseline=0;routeHash=bytes32(0);}
 function rescueERC20(address token,address to,uint amount) external onlyOwner whenPaused {if(token==address(0)||to==address(0))revert ZeroAddress();if(active)revert RescueOnlyPaused();IERC20(token).safeTransfer(to,amount);emit EmergencyTokenRescue(token,to,amount);}
 receive() external payable{revert();} fallback() external payable{revert();}
}