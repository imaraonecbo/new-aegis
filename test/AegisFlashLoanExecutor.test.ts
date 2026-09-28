import {expect} from "chai";import {network} from "hardhat";
describe("AegisFlashLoanExecutor",function(){
 it("deploys only with non-zero trusted endpoints and starts owner-authorized",async function(){
  const {ethers}=await network.connect();const [owner]=await ethers.getSigners();
  const f=await ethers.getContractFactory("AegisFlashLoanExecutor");
  const c=await f.deploy("0x0000000000000000000000000000000000000001","0x0000000000000000000000000000000000000002",owner.address);
  await c.waitForDeployment();expect(await c.authorizedRelayers(owner.address)).to.equal(true);expect(await c.authorizedSigners(owner.address)).to.equal(true);
 });
 it("pauses and blocks execution entry",async function(){
  const {ethers}=await network.connect();const [owner]=await ethers.getSigners();const f=await ethers.getContractFactory("AegisFlashLoanExecutor");
  const c=await f.deploy("0x0000000000000000000000000000000000000001","0x0000000000000000000000000000000000000002",owner.address);await c.pause();expect(await c.paused()).to.equal(true);
 });
});