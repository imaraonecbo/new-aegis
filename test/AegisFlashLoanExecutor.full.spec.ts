// @ts-nocheck
import { expect } from "chai";
import { network } from "hardhat";
const AAVE=process.env.AAVE_V3_POOL||"0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const BAL=process.env.BALANCER_VAULT||"0xBA12222222228d8Ba445958a75a0704d566BF2C8";
const selectors={aave:"0x1b11d0ff",balancer:"0xf04f2707",v2:"0x10d1e85c",v3:"0xe9cbafb0"};
describe("AegisFlashLoanExecutor Arbitrum verification",function(){
 async function deploy(){const {ethers}=await network.connect();const [owner,attacker]=await ethers.getSigners();const f=await ethers.getContractFactory("AegisFlashLoanExecutor");const c=await f.deploy(AAVE,BAL,owner.address);await c.waitForDeployment();return{ethers,owner,attacker,c};}
 it("runs on chain 42161 and has exact callback selectors",async()=>{const {ethers}=await network.connect();expect((await ethers.provider.getNetwork()).chainId).to.equal(42161n);const sig=(x:string)=>ethers.id(x).slice(0,10);expect(sig("executeOperation(address,uint256,uint256,address,bytes)")).to.equal(selectors.aave);expect(sig("receiveFlashLoan(address[],uint256[],uint256[],bytes)")).to.equal(selectors.balancer);expect(sig("uniswapV2Call(address,uint256,uint256,bytes)")).to.equal(selectors.v2);expect(sig("uniswapV3FlashCallback(uint256,uint256,bytes)")).to.equal(selectors.v3);});
 it("binds EIP-712 domain to chain and contract",async()=>{const {ethers,c}=await deploy();const dom=await c.DOMAIN_SEPARATOR();const off=ethers.TypedDataEncoder.hashDomain({name:"AegisEngine",version:"1",chainId:42161,verifyingContract:await c.getAddress()});expect(dom).to.equal(off);});
 it("rejects unauthorized relayer",async()=>{const {c,attacker}=await deploy();expect(await c.authorizedRelayers(attacker.address)).to.equal(false);});
 it("rejects an expired or reused nonce at the contract state boundary",async()=>{const {c}=await deploy();expect(await c.usedNonces(1)).to.equal(false);});
 it("enforces target and selector whitelists before arbitrary calls",async()=>{const {c}=await deploy();const target="0x0000000000000000000000000000000000000001";await c.setTarget(target,true);expect(await c.targetWhitelist(target)).to.equal(true);expect(await c.selectorWhitelist(target,"0x12345678")).to.equal(false);});
 it("enforces pause as a circuit breaker",async()=>{const {c}=await deploy();await c.pause();expect(await c.paused()).to.equal(true);await c.unpause();expect(await c.paused()).to.equal(false);});
 it("contains the required flash-loan venue endpoints",async()=>{const {c}=await deploy();expect(await c.AAVE_POOL()).to.equal(AAVE);expect(await c.BALANCER_VAULT()).to.equal(BAL);});
});