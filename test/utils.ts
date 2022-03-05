import { BigNumber, Contract } from 'ethers';
import { ethers, network, waffle } from 'hardhat';

export function getBigNumber(n: number, decimals = 18) {
  return BigNumber.from(10).pow(decimals).mul(n);
}

export async function deployContract<C extends Contract>(name: string, ...args: any[]): Promise<C> {
  const f = await ethers.getContractFactory(name);
  const c = await f.deploy(...args);
  return c as C;
}

export async function advanceBlock() {
  return waffle.provider.send("evm_mine", [])
}

export async function setNextTimestamp(time: number) {
  await waffle.provider.send('evm_setNextBlockTimestamp', [time])
}

export async function setTimestampAndAdvanceBlock(time: number) {
  await setNextTimestamp(time)
  await advanceBlock()
}

export async function snapshotEVM() {
  let snapshotId = await network.provider.request({ method: 'evm_snapshot' });
  return async () => {
    await network.provider.request({ method: 'evm_revert', params: [snapshotId] });
    snapshotId = await network.provider.request({ method: 'evm_snapshot' });
  }
}