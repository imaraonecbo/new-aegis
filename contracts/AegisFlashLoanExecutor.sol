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
interface IUniswapV2Pair { function token0() external view returns(address); function token1() external view returns(address); function swap(uint256,uint256,address,bytes calldata) external; }
interface IUniswapV3Factory { function getPool(address,address,uint24) external view returns(address); }
interface IUniswapV3Pool { function token0() external view returns(address); function token1() external view returns(address); function fee() external view returns(uint24); function factory() external view returns(address); function flash(address,uint256,uint256,bytes calldata) external; }

interface IUniswapV2Callee { function uniswapV2Call(address,uint256,uint256,bytes calldata) external; }
interface IUniswapV3FlashCallback { function uniswapV3FlashCallback(uint256,uint256,bytes calldata) external; }

contract AegisFlashLoanExecutor is EIP712,Ownable,ReentrancyGuard,Pausable,IUniswapV2Callee,IUniswapV3FlashCallback {
    using SafeERC20 for IERC20;

    address public constant UNISWAP_V3_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;

    bytes32 public constant EXECUTION_TYPEHASH =
        keccak256("Execution(address asset,uint256 amount,uint256 minProfit,uint256 relayerFeeCap,address relayer,address feeRecipient,uint256 nonce,uint256 deadline,uint256 targetBlock,bytes32 routeHash)");

    struct Execution {
        address asset;
        uint256 amount;
        uint256 minProfit;
        uint256 relayerFeeCap;
        address relayer;
        address feeRecipient;
        uint256 nonce;
        uint256 deadline;
        uint256 targetBlock;
        bytes32 routeHash;
    }
    struct Call { address target; uint256 value; bytes data; }
    struct Approval { address token; address spender; uint256 amount; }

    struct BalancerFlashData {
        Execution execution;
        address[] tokens;
        uint256[] amounts;
        uint256[] baselines;
        Call[] calls;
        Approval[] approvals;
        bytes signature;
    }

    IAaveV3Pool public immutable AAVE_POOL;
    IBalancerVault public immutable BALANCER_VAULT;

    mapping(address => bool) public authorizedRelayers;
    mapping(address => bool) public authorizedSigners;
    mapping(address => bool) public targetWhitelist;
    mapping(address => bool) public v2PairWhitelist;
    mapping(address => mapping(bytes4 => bool)) public selectorWhitelist;
    mapping(uint256 => bool) public usedNonces;

    bool private active;
    uint8 private activeSource;
    address private activeSourceAddress;
    address private activeAsset;
    uint256 private activePrincipal;
    uint256 private activeBaseline;
    address private activeRelayer;
    bytes32 private activeExecutionHash;
    bytes32 private activeLoanHash;

    uint8 private constant SOURCE_AAVE = 1;
    uint8 private constant SOURCE_BALANCER = 2;
    uint8 private constant SOURCE_V2 = 3;
    uint8 private constant SOURCE_V3 = 4;

    error UnauthorizedRelayer();
    error InvalidSignature();
    error DeadlineExpired();
    error TargetBlockMismatch();
    error NonceUsed();
    error InvalidRoute();
    error TargetNotAllowed();
    error SelectorNotAllowed();
    error InvalidAmount();
    error InvalidCaller();
    error InvalidRecipient();
    error ValueNotAllowed();
    error InvalidPool();
    error InvalidArrayLength();
    error ProfitInvariantFailed(uint256 requiredBalance,uint256 actualBalance);
    error RescueOnlyPaused();
    error ZeroAddress();

    event RelayerAuthorizationUpdated(address indexed relayer,bool enabled);
    event SignerAuthorizationUpdated(address indexed signer,bool enabled);
    event TargetWhitelistUpdated(address indexed target,bool enabled);
    event V2PairWhitelistUpdated(address indexed pair,bool enabled);
    event SelectorWhitelistUpdated(address indexed target,bytes4 indexed selector,bool enabled);
    event ExecutionCompleted(uint256 indexed nonce,address indexed asset,uint256 principal,uint256 fee,uint256 relayerFeeCap,uint256 profit,bytes32 routeHash);
    event EmergencyTokenRescue(address indexed token,address indexed to,uint256 amount);

    constructor(address aave,address balancer,address owner_) EIP712("AegisEngine","1") Ownable(owner_) {
        if(aave==address(0)||balancer==address(0)||owner_==address(0)) revert ZeroAddress();
        AAVE_POOL=IAaveV3Pool(aave);
        BALANCER_VAULT=IBalancerVault(balancer);
        authorizedRelayers[owner_]=true;
        authorizedSigners[owner_]=true;
    }

    function DOMAIN_SEPARATOR() external view returns(bytes32) { return _domainSeparatorV4(); }

    modifier onlyRelayer(){ if(!authorizedRelayers[msg.sender]) revert UnauthorizedRelayer(); _; }
    modifier onlyActive(){ if(!active) revert InvalidCaller(); _; }

    function setRelayer(address a,bool v) external onlyOwner { if(a==address(0)) revert ZeroAddress(); authorizedRelayers[a]=v; emit RelayerAuthorizationUpdated(a,v); }
    function setSigner(address a,bool v) external onlyOwner { if(a==address(0)) revert ZeroAddress(); authorizedSigners[a]=v; emit SignerAuthorizationUpdated(a,v); }
    function setTarget(address a,bool v) external onlyOwner { if(a==address(0)) revert ZeroAddress(); targetWhitelist[a]=v; emit TargetWhitelistUpdated(a,v); }
    function setV2Pair(address a,bool v) external onlyOwner { if(a==address(0)) revert ZeroAddress(); v2PairWhitelist[a]=v; emit V2PairWhitelistUpdated(a,v); }
    function setSelector(address a,bytes4 s,bool v) external onlyOwner { if(a==address(0)) revert ZeroAddress(); selectorWhitelist[a][s]=v; emit SelectorWhitelistUpdated(a,s,v); }
    function pause() external onlyOwner {_pause();}
    function unpause() external onlyOwner {_unpause();}

    function executeFlashLoan(Execution calldata e,Call[] calldata c,Approval[] calldata a,bytes calldata sig)
        external nonReentrant whenNotPaused onlyRelayer
    {
        _validate(e,c,a,sig,msg.sender);
        usedNonces[e.nonce]=true;
        _begin(SOURCE_AAVE,address(AAVE_POOL),e,e.routeHash);
        AAVE_POOL.flashLoanSimple(address(this),e.asset,e.amount,abi.encode(e,c,a,sig),0);
        _clear();
    }

    function executeBalancerFlashLoan(
        Execution calldata e,
        address[] calldata tokens,
        uint256[] calldata amounts,
        Call[] calldata c,
        Approval[] calldata a,
        bytes calldata sig
    ) external nonReentrant whenNotPaused onlyRelayer {
        if(tokens.length==0||tokens.length!=amounts.length||e.amount==0) revert InvalidArrayLength();
        _validate(e,c,a,sig,msg.sender);
        uint256[] memory baselines=new uint256[](tokens.length);
        bool primaryFound=false;
        for(uint256 i;i<tokens.length;i++){ if(tokens[i]==address(0)||amounts[i]==0) revert InvalidAmount(); baselines[i]=IERC20(tokens[i]).balanceOf(address(this)); if(tokens[i]==e.asset){ if(primaryFound) revert InvalidArrayLength(); primaryFound=true; if(amounts[i]!=e.amount) revert InvalidAmount(); } }
        if(!primaryFound) revert InvalidAmount();
        usedNonces[e.nonce]=true;
        _begin(SOURCE_BALANCER,address(BALANCER_VAULT),e,keccak256(abi.encode(tokens,amounts)));
        BALANCER_VAULT.flashLoan(address(this),tokens,amounts,abi.encode(e,tokens,amounts,baselines,c,a,sig));
        _clear();
    }

    function executeUniswapV2FlashLoan(
        Execution calldata e,
        address pair,
        uint256 amount0Out,
        uint256 amount1Out,
        Call[] calldata c,
        Approval[] calldata a,
        bytes calldata sig
    ) external nonReentrant whenNotPaused onlyRelayer {
        if(!v2PairWhitelist[pair]) revert InvalidPool();
        if(amount0Out==0&&amount1Out==0) revert InvalidAmount();
        if(amount0Out>0&&amount1Out>0) revert InvalidAmount();
        address token0=IUniswapV2Pair(pair).token0();
        address token1=IUniswapV2Pair(pair).token1();
        address borrowed=amount0Out>0?token0:token1;
        uint256 amount=amount0Out>0?amount0Out:amount1Out;
        if(e.asset!=borrowed||e.amount!=amount) revert InvalidAmount();
        _validate(e,c,a,sig,msg.sender);
        usedNonces[e.nonce]=true;
        _begin(SOURCE_V2,pair,e,e.routeHash);
        IUniswapV2Pair(pair).swap(amount0Out,amount1Out,address(this),abi.encode(e,c,a,sig));
        _clear();
    }

    function executeUniswapV3FlashLoan(
        Execution calldata e,
        address pool,
        uint256 amount0,
        uint256 amount1,
        Call[] calldata c,
        Approval[] calldata a,
        bytes calldata sig
    ) external nonReentrant whenNotPaused onlyRelayer {
        _assertCanonicalV3Pool(pool);
        if(amount0==0&&amount1==0) revert InvalidAmount();
        if(amount0>0&&amount1>0) revert InvalidAmount();
        address token0=IUniswapV3Pool(pool).token0();
        address token1=IUniswapV3Pool(pool).token1();
        address borrowed=amount0>0?token0:token1;
        uint256 amount=amount0>0?amount0:amount1;
        if(e.asset!=borrowed||e.amount!=amount) revert InvalidAmount();
        _validate(e,c,a,sig,msg.sender);
        usedNonces[e.nonce]=true;
        _begin(SOURCE_V3,pool,e,e.routeHash);
        IUniswapV3Pool(pool).flash(address(this),amount0,amount1,abi.encode(e,c,a,sig));
        _clear();
    }

    function _begin(uint8 source,address sourceAddress,Execution calldata e,bytes32 loanHash) internal {
        active=true; activeSource=source; activeSourceAddress=sourceAddress; activeAsset=e.asset; activePrincipal=e.amount;
        activeBaseline=IERC20(e.asset).balanceOf(address(this)); activeRelayer=e.relayer;
        activeExecutionHash=_executionHash(e); activeLoanHash=loanHash;
    }

    function _validate(Execution calldata e,Call[] calldata c,Approval[] calldata a,bytes calldata sig,address caller) internal view {
        if(e.asset==address(0)||e.amount==0) revert InvalidAmount();
        if(e.relayer!=caller||e.feeRecipient!=caller) revert InvalidRecipient();
        if(e.deadline<block.timestamp) revert DeadlineExpired();
        if(e.targetBlock!=block.number) revert TargetBlockMismatch();
        if(usedNonces[e.nonce]) revert NonceUsed();
        if(keccak256(abi.encode(c,a))!=e.routeHash) revert InvalidRoute();
        bytes32 digest=_executionHash(e);
        if(!authorizedSigners[ECDSA.recover(_hashTypedDataV4(digest),sig)]) revert InvalidSignature();
    }

    function _executionHash(Execution memory e) internal pure returns(bytes32){
        return keccak256(abi.encode(EXECUTION_TYPEHASH,e.asset,e.amount,e.minProfit,e.relayerFeeCap,e.relayer,e.feeRecipient,e.nonce,e.deadline,e.targetBlock,e.routeHash));
    }

    function _validateCallback(Execution memory e,Call[] memory c,Approval[] memory a,bytes memory sig) internal view {
        if(_executionHash(e)!=activeExecutionHash) revert InvalidRoute();
        if(e.relayer!=activeRelayer) revert InvalidRecipient();
        if(e.deadline<block.timestamp) revert DeadlineExpired();
        if(e.targetBlock!=block.number) revert TargetBlockMismatch();
        if(keccak256(abi.encode(c,a))!=e.routeHash||e.routeHash!=activeLoanHash&&activeSource==SOURCE_BALANCER) revert InvalidRoute();
        bytes32 digest=_executionHash(e);
        if(!authorizedSigners[ECDSA.recover(_hashTypedDataV4(digest),sig)]) revert InvalidSignature();
    }

    function executeOperation(address a,uint256 amount,uint256 premium,address initiator,bytes calldata p)
        external onlyActive returns(bool)
    {
        if(activeSource!=SOURCE_AAVE||msg.sender!=address(AAVE_POOL)||initiator!=address(this)||a!=activeAsset||amount!=activePrincipal) revert InvalidCaller();
        (Execution memory e,Call[] memory c,Approval[] memory ap,bytes memory sig)=abi.decode(p,(Execution,Call[],Approval[],bytes));
        _validateCallback(e,c,ap,sig);
        _run(ap,c);
        _settleSingle(e,a,amount,premium,address(AAVE_POOL));
        return true;
    }

    function receiveFlashLoan(address[] calldata tokens,uint256[] calldata amounts,uint256[] calldata feeAmounts,bytes calldata p)
        external onlyActive
    {
        if(activeSource!=SOURCE_BALANCER||msg.sender!=address(BALANCER_VAULT)||tokens.length==0||tokens.length!=amounts.length||tokens.length!=feeAmounts.length) revert InvalidCaller();
        (Execution memory e,address[] memory dataTokens,uint256[] memory dataAmounts,uint256[] memory baselines,Call[] memory c,Approval[] memory ap,bytes memory sig)=abi.decode(p,(Execution,address[],uint256[],uint256[],Call[],Approval[],bytes));
        if(dataTokens.length!=tokens.length||dataAmounts.length!=tokens.length||baselines.length!=tokens.length) revert InvalidArrayLength();
        if(keccak256(abi.encode(tokens,amounts))!=activeLoanHash) revert InvalidRoute();
        _validateCallback(e,c,ap,sig);
        for(uint256 i;i<tokens.length;i++){ if(tokens[i]!=dataTokens[i]||amounts[i]!=dataAmounts[i]) revert InvalidRoute(); }
        _run(ap,c);
        uint256 primaryBalance=0;
        for(uint256 i;i<tokens.length;i++){
            uint256 extra=(tokens[i]==e.asset)?(e.relayerFeeCap+e.minProfit):0;
            uint256 required=baselines[i]+amounts[i]+feeAmounts[i]+extra;
            uint256 bal=IERC20(tokens[i]).balanceOf(address(this));
            if(bal<required) revert ProfitInvariantFailed(required,bal);
            if(tokens[i]==e.asset) primaryBalance=bal;
        }
        if(e.relayerFeeCap>0) IERC20(e.asset).safeTransfer(e.feeRecipient,e.relayerFeeCap);
        for(uint256 i;i<tokens.length;i++) IERC20(tokens[i]).safeTransfer(address(BALANCER_VAULT),amounts[i]+feeAmounts[i]);
        uint256 post=IERC20(e.asset).balanceOf(address(this));
        uint256 requiredPost=0;
        for(uint256 i=0;i<tokens.length;i++) if(tokens[i]==e.asset){requiredPost=baselines[i]+e.minProfit;break;}
        if(post<requiredPost) revert ProfitInvariantFailed(requiredPost,post);
        emit ExecutionCompleted(e.nonce,e.asset,e.amount,feeAmounts[0],e.relayerFeeCap,post-activeBaseline-e.amount-feeAmounts[0],e.routeHash);
    }

    function uniswapV2Call(address sender,uint256 amount0,uint256 amount1,bytes calldata data) external override onlyActive {
        if(activeSource!=SOURCE_V2||msg.sender!=activeSourceAddress||!v2PairWhitelist[msg.sender]||sender!=address(this)) revert InvalidCaller();
        if(amount0>0&&amount1>0) revert InvalidAmount();
        (Execution memory e,Call[] memory c,Approval[] memory ap,bytes memory sig)=abi.decode(data,(Execution,Call[],Approval[],bytes));
        _validateCallback(e,c,ap,sig);
        uint256 borrowed=amount0>0?amount0:amount1;
        if(borrowed!=activePrincipal) revert InvalidAmount();
        uint256 fee=(borrowed*3)/997+1;
        uint256 repayment=borrowed+fee;
        _run(ap,c);
        uint256 bal=IERC20(e.asset).balanceOf(address(this));
        uint256 required=activeBaseline+repayment+e.relayerFeeCap+e.minProfit;
        if(bal<required) revert ProfitInvariantFailed(required,bal);
        if(e.relayerFeeCap>0) IERC20(e.asset).safeTransfer(e.feeRecipient,e.relayerFeeCap);
        IERC20(e.asset).safeTransfer(msg.sender,repayment);
        uint256 post=IERC20(e.asset).balanceOf(address(this));
        uint256 requiredPost=activeBaseline+e.minProfit;
        if(post<requiredPost) revert ProfitInvariantFailed(requiredPost,post);
        emit ExecutionCompleted(e.nonce,e.asset,borrowed,fee,e.relayerFeeCap,post-activeBaseline,e.routeHash);
    }

    function uniswapV3FlashCallback(uint256 fee0,uint256 fee1,bytes calldata data) external override onlyActive {
        if(activeSource!=SOURCE_V3||msg.sender!=activeSourceAddress) revert InvalidCaller();
        _assertCanonicalV3Pool(msg.sender);
        if(fee0>0&&fee1>0) revert InvalidAmount();
        (Execution memory e,Call[] memory c,Approval[] memory ap,bytes memory sig)=abi.decode(data,(Execution,Call[],Approval[],bytes));
        _validateCallback(e,c,ap,sig);
        uint256 fee=e.asset==IUniswapV3Pool(msg.sender).token0()?fee0:fee1;
        _run(ap,c);
        uint256 bal=IERC20(e.asset).balanceOf(address(this));
        uint256 required=activeBaseline+e.amount+fee+e.relayerFeeCap+e.minProfit;
        if(bal<required) revert ProfitInvariantFailed(required,bal);
        if(e.relayerFeeCap>0) IERC20(e.asset).safeTransfer(e.feeRecipient,e.relayerFeeCap);
        IERC20(e.asset).safeTransfer(msg.sender,e.amount+fee);
        uint256 post=IERC20(e.asset).balanceOf(address(this));
        uint256 requiredPost=activeBaseline+e.minProfit;
        if(post<requiredPost) revert ProfitInvariantFailed(requiredPost,post);
        emit ExecutionCompleted(e.nonce,e.asset,e.amount,fee,e.relayerFeeCap,post-activeBaseline,e.routeHash);
    }

    function _settleSingle(Execution memory e,address token,uint256 amount,uint256 premium,address lender) internal {
        _runNoop();
        uint256 bal=IERC20(token).balanceOf(address(this));
        uint256 required=activeBaseline+amount+premium+e.relayerFeeCap+e.minProfit;
        if(bal<required) revert ProfitInvariantFailed(required,bal);
        if(e.relayerFeeCap>0) IERC20(token).safeTransfer(e.feeRecipient,e.relayerFeeCap);
        IERC20(token).forceApprove(lender,amount+premium);
        uint256 post=IERC20(token).balanceOf(address(this));
        uint256 requiredPost=activeBaseline+amount+premium+e.minProfit;
        if(post<requiredPost) revert ProfitInvariantFailed(requiredPost,post);
        emit ExecutionCompleted(e.nonce,token,amount,premium,e.relayerFeeCap,post-activeBaseline-amount-premium,e.routeHash);
    }

    function _runNoop() internal pure {}

    function _run(Approval[] memory ap,Call[] memory c) internal {
        for(uint256 i=0;i<ap.length;i++){ if(ap[i].token==address(0)||ap[i].spender==address(0)||!targetWhitelist[ap[i].spender]) revert TargetNotAllowed(); IERC20(ap[i].token).forceApprove(ap[i].spender,ap[i].amount); }
        for(uint256 i=0;i<c.length;i++){
            if(c[i].target==address(0)||!targetWhitelist[c[i].target]||c[i].value!=0||c[i].data.length<4) revert TargetNotAllowed();
            bytes4 selector; assembly { selector := mload(add(mload(add(c,0x20)),0x20)) }
            bytes calldata cd; 
            cd=c[i].data;
            bytes4 s; assembly { s := calldataload(cd.offset) }
            if(!selectorWhitelist[c[i].target][s]) revert SelectorNotAllowed();
            (bool ok,bytes memory r)=c[i].target.call(c[i].data); if(!ok) assembly { revert(add(r,32),mload(r)) }
        }
        for(uint256 i=0;i<ap.length;i++) IERC20(ap[i].token).forceApprove(ap[i].spender,0);
    }

    function _assertCanonicalV3Pool(address pool) internal view {
        if(pool==address(0)) revert InvalidPool();
        address f;
        try IUniswapV3Pool(pool).factory() returns(address factory_) { f=factory_; } catch { revert InvalidPool(); }
        if(f!=UNISWAP_V3_FACTORY) revert InvalidPool();
        address t0=IUniswapV3Pool(pool).token0();
        address t1=IUniswapV3Pool(pool).token1();
        uint24 tier=IUniswapV3Pool(pool).fee();
        if(IUniswapV3Factory(UNISWAP_V3_FACTORY).getPool(t0,t1,tier)!=pool) revert InvalidPool();
    }

    function _clear() internal {
        active=false; activeSource=0; activeSourceAddress=address(0); activeAsset=address(0); activePrincipal=0; activeBaseline=0; activeRelayer=address(0); activeExecutionHash=bytes32(0); activeLoanHash=bytes32(0);
    }

    function rescueERC20(address token,address to,uint256 amount) external onlyOwner whenPaused {
        if(token==address(0)||to==address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to,amount);
        emit EmergencyTokenRescue(token,to,amount);
    }

    receive() external payable { revert(); }
    fallback() external payable { revert(); }
}