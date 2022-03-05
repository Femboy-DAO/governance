import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { TimelockController, Governess, Fem, FemErecter, GovernessActivator } from '../typechain';
import { deployContract, getBigNumber, setTimestampAndAdvanceBlock } from './utils';

const saleDuration = 86400 * 14;
const saleOffset = 86400;
const timeToSpend = 86400 * 30;
const minimumEthRaised = getBigNumber(1);
const devTokenBips = 100;

describe('GovernessActivator', () => {
  const [_, dev] = waffle.provider.getWallets()

  let timelockController: TimelockController;
  let governess: Governess;
  let governessActivator: GovernessActivator
  let fem: Fem;
  let femErecter: FemErecter;
  let saleStartTime: number;

  const goToStart = () => setTimestampAndAdvanceBlock(saleStartTime + 1)
  const goToEnd = () => setTimestampAndAdvanceBlock(saleStartTime + saleDuration + 1)
  const goToDeadline = () => setTimestampAndAdvanceBlock(saleStartTime + saleDuration + timeToSpend + 1)

  beforeEach('Deploy activator', async () => {
    fem = await deployContract('Fem') as Fem
    const {timestamp} = await ethers.provider.getBlock('latest')
    
    saleStartTime = timestamp + saleOffset;
    governessActivator = await deployContract(
      'GovernessActivator',
      fem.address,
      dev.address,
      devTokenBips,
      saleStartTime,
      saleDuration,
      timeToSpend,
      minimumEthRaised
    );
    governess = await ethers.getContractAt('Governess', await governessActivator.governess()) as Governess;
    timelockController = await ethers.getContractAt('TimelockController', await governessActivator.timelockController()) as TimelockController;
    femErecter = await ethers.getContractAt('FemErecter', await governessActivator.femErecter()) as FemErecter;
    await fem.transferOwnership(femErecter.address)
  })

  describe('TimelockController', () => {
    it('Renounces admin role', async () => {
      await expect(governessActivator.deployTransaction)
        .to.emit(timelockController, 'RoleRevoked')
        .withArgs(await timelockController.TIMELOCK_ADMIN_ROLE(), governessActivator.address, governessActivator.address)
    })

    it('Sets delay to 2 days', async () => {
      expect(await timelockController.getMinDelay()).to.eq(86400*2)
    })

    it('Sets proposer role to governess', async () => {
      expect(await timelockController.hasRole(await timelockController.PROPOSER_ROLE(), governess.address)).to.be.true
    })
  })

  describe('Governess', () => {
    it('Sets timelock to activator', async () => {
      expect(await governess.timelock()).to.eq(governessActivator.address)
    })

    it('Sets token to Fem', async () => {
      expect(await governess.token()).to.eq(fem.address)
    })

    it('Sets proposalThreshold to 2**256-1', async () => {
      expect(await governess.proposalThreshold()).to.eq(constants.MaxUint256)
    })
  })

  describe('FemErecter', () => {
    it('owner', async () => {
      expect(await femErecter.owner()).to.eq(timelockController.address)
    })

    it('devAddress', async () => {
      expect(await femErecter.devAddress()).to.eq(dev.address)
    })

    it('devTokenBips', async () => {
      expect(await femErecter.devTokenBips()).to.eq(devTokenBips)
    })

    it('fem', async () => {
      expect(await femErecter.fem()).to.eq(fem.address)
    })

    it('saleStartTime', async () => {
      expect(await femErecter.saleStartTime()).to.eq(saleStartTime)
    })

    it('saleEndTime', async () => {
      expect(await femErecter.saleEndTime()).to.eq(saleStartTime + saleDuration)
    })

    it('saleDuration', async () => {
      expect(await femErecter.saleDuration()).to.eq(saleDuration)
    })

    it('spendDeadline', async () => {
      expect(await femErecter.spendDeadline()).to.eq(saleStartTime + saleDuration + timeToSpend)
    })

    it('minimumEthRaised', async () => {
      expect(await femErecter.minimumEthRaised()).to.eq(minimumEthRaised)
    })
  })

  describe('activateGoverness', () => {
    it('Reverts if funds not pending', async () => {
      await expect(governessActivator.activateGoverness())
        .to.be.revertedWith('Can not activate governess before sale succeeds')
    })

    it('Sets proposal threshold to 1% of supply', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      await governessActivator.activateGoverness()
      expect(await governess.proposalThreshold()).to.eq(minimumEthRaised.div(100))
    })

    it('Sets timelock to timelock address', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      await governessActivator.activateGoverness()
      expect(await governess.timelock()).to.eq(timelockController.address)
    })
  })
})