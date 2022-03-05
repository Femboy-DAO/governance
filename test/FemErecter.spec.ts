import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { FemErecter, Fem } from '../typechain'
import { snapshotEVM, deployContract, getBigNumber, setTimestampAndAdvanceBlock } from './utils';

const saleDuration = 86400 * 14;
const saleOffset = 86400;
const timeToSpend = 86400 * 30;
const minimumEthRaised = getBigNumber(1);
const devTokenBips = 100;

enum SaleState {
  PENDING = 0,
  ACTIVE = 1,
  FUNDS_PENDING = 2,
  SUCCESS = 3,
  FAILURE = 4
}

describe('FemErecter', () => {
  const [owner, notOwner, dev] = waffle.provider.getWallets()
  let femErecter: FemErecter
  let fem: Fem
  let saleStartTime: number
  let reset: () => Promise<void>

  const goToStart = () => setTimestampAndAdvanceBlock(saleStartTime + 1)
  const goToEnd = () => setTimestampAndAdvanceBlock(saleStartTime + saleDuration + 1)
  const goToDeadline = () => setTimestampAndAdvanceBlock(saleStartTime + saleDuration + timeToSpend + 1)

  before(async () => {
    fem = await deployContract('Fem')
    const {timestamp} = await ethers.provider.getBlock('latest')
    saleStartTime = timestamp + saleOffset
    femErecter = await deployContract('FemErecter', owner.address, dev.address, devTokenBips, fem.address, saleStartTime, saleDuration, timeToSpend, minimumEthRaised)
    await fem.transferOwnership(femErecter.address)
    reset = await snapshotEVM()
  })

  beforeEach(async () => { await reset() })

  describe('Constructor', () => {
    it('Reverts if saleStartTime too early', async () => {
      const {timestamp} = await ethers.provider.getBlock('latest')
      await expect(deployContract('FemErecter', owner.address, dev.address, devTokenBips, fem.address, timestamp, saleDuration, timeToSpend, minimumEthRaised))
        .to.be.revertedWith('start too early')
    })

    it('Reverts if devTokenBips is 0', async () => {
      const {timestamp} = await ethers.provider.getBlock('latest')
      await expect(deployContract('FemErecter', owner.address, dev.address, 0, fem.address, timestamp, saleDuration, timeToSpend, minimumEthRaised))
        .to.be.revertedWith('devTokenBips can not be 0')
    })

    it('Reverts if devTokenBips >= 1000', async () => {
      const {timestamp} = await ethers.provider.getBlock('latest')
      await expect(deployContract('FemErecter', owner.address, dev.address, 1000, fem.address, timestamp, saleDuration, timeToSpend, minimumEthRaised))
        .to.be.revertedWith('devTokenBips too high')
    })

    it('devAddress', async () => {
      expect(await femErecter.devAddress()).to.eq(dev.address)
    })

    it('devTokenBips', async () => {
      expect(await femErecter.devTokenBips()).to.eq(devTokenBips)
    })

    it('owner', async () => {
      expect(await femErecter.owner()).to.eq(owner.address)
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

  describe('state', () => {
    it('PENDING before start', async () => {
      expect(await femErecter.state()).to.eq(SaleState.PENDING)
    })

    it('ACTIVE after start and before end', async () => {
      await goToStart()
      expect(await femErecter.state()).to.eq(SaleState.ACTIVE)
    })

    it('FUNDS_PENDING after end if sufficient ETH raised', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      expect(await femErecter.state()).to.eq(SaleState.FUNDS_PENDING)
    })

    it('FAILURE after end if insufficient ETH deposited', async () => {
      await goToEnd()
      expect(await femErecter.state()).to.eq(SaleState.FAILURE)
    })

    it('FAILURE after spend deadline if ETH not claimed', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      expect(await femErecter.state()).to.eq(SaleState.FUNDS_PENDING)
      await goToDeadline()
      expect(await femErecter.state()).to.eq(SaleState.FAILURE)
    })
    
    it('SUCCESS after end if ETH claimed', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      await femErecter.claimETH(owner.address)
      expect(await femErecter.state()).to.eq(SaleState.SUCCESS)
    })
    
    it('SUCCESS after deadline if ETH claimed', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      await femErecter.claimETH(owner.address)
      await goToDeadline()
      expect(await femErecter.state()).to.eq(SaleState.SUCCESS)
    })
  })

  describe('deposit', () => {
    it('Reverts if sale inactive', async () => {
      await expect(femErecter.deposit({ value: 1 }))
        .to.be.revertedWith('Sale not active')
    })

    it('Reverts if 0 value', async () => {
      await goToStart()
      await expect(femErecter.deposit({ value: 0 }))
        .to.be.revertedWith('Can not deposit 0 ETH')
    })

    it('Increases depositedAmount', async () => {
      await goToStart()
      await femErecter.deposit({ value: getBigNumber(1) })
      expect(await femErecter.depositedAmount(owner.address)).to.eq(getBigNumber(1))
    })

    it('Emits Deposit', async () => {
      await goToStart()
      await expect(femErecter.deposit({ value: getBigNumber(1) }))
        .to.emit(femErecter, 'Deposit')
        .withArgs(owner.address, getBigNumber(1))
    })

    it('Mints governance tokens', async () => {
      await goToStart()
      await expect(femErecter.deposit({ value: getBigNumber(1) }))
        .to.emit(fem, 'Transfer')
        .withArgs(constants.AddressZero, owner.address, getBigNumber(1))
    })
  })

  describe('claimETH', () => {
    it('Reverts if not owner', async () => {
      await expect(femErecter.connect(notOwner).claimETH(owner.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('Reverts if sale not over', async () => {
      await expect(femErecter.claimETH(owner.address))
        .to.be.revertedWith('Funds not pending governance claim')
    })

    it('Reverts if spend deadline passed', async () => {
      await goToDeadline()
      await expect(femErecter.claimETH(owner.address))
        .to.be.revertedWith('Funds not pending governance claim')
    })

    it('Reverts if ETH transfer fails', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      await expect(femErecter.claimETH(femErecter.address))
        .to.be.revertedWith('Failed to transfer ETH')
    })

    it('Reverts if insufficient ETH raised', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised.sub(1) })
      await goToEnd()
      await expect(femErecter.claimETH(owner.address))
        .to.be.revertedWith('Funds not pending governance claim')
    })

    it('Transfers balance between end and deadline', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      await femErecter.claimETH('0x00000000000000000000000000000000000000ff')
      expect(await ethers.provider.getBalance('0x00000000000000000000000000000000000000ff'))
        .to.eq(minimumEthRaised)
    })

    it('Emits EthClaimed', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      await expect(femErecter.claimETH(owner.address))
        .to.emit(femErecter, 'EthClaimed')
        .withArgs(owner.address, minimumEthRaised)
    })

    it('Sets ethClaimed', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      await femErecter.claimETH(owner.address)
      expect(await femErecter.ethClaimed()).to.be.true
    })

    it('Sets fem owner to contract owner', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      await femErecter.claimETH(owner.address)
      expect(await fem.owner()).to.eq(owner.address)
    })

    it('Mints devTokenBips/10000 of supply to devAddress', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      await expect(femErecter.claimETH(owner.address))
        .to.emit(fem, 'Transfer')
        .withArgs(constants.AddressZero, dev.address, minimumEthRaised.mul(devTokenBips).div(10000))
    })
  })

  describe('burnFem', () => {
    it('Reverts before deadline', async () => {
      await expect(femErecter.burnFem(minimumEthRaised))
        .to.be.revertedWith('Sale has not failed')
    })

    it('Reverts if eth has been claimed', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToEnd()
      await femErecter.claimETH(owner.address)
      await goToDeadline()
      await expect(femErecter.burnFem(minimumEthRaised))
        .to.be.revertedWith('Sale has not failed')
    })

    it('Transfers FEM from caller', async () => {
      await goToStart()
      await femErecter.deposit({ value: minimumEthRaised })
      await goToDeadline()
      await expect(femErecter.burnFem(minimumEthRaised))
        .to.emit(fem, 'Transfer')
        .withArgs(owner.address, constants.AddressZero, minimumEthRaised)
    })
  })
})