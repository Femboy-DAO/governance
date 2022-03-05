import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { Fem } from '../typechain'
import { advanceBlock, deployContract, getBigNumber } from './utils';

describe('Fem', () => {
  const [owner, notOwner] = waffle.provider.getWallets()
  let fem: Fem

  beforeEach(async () => {
    fem = await deployContract('Fem')
  })

  describe('mint', () => {
    it('Reverts if not called by owner', async () => {
      await expect(fem.connect(notOwner).mint(owner.address, getBigNumber(1)))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('Increases balance', async () => {
      await fem.mint(owner.address, getBigNumber(1))
      expect(await fem.balanceOf(owner.address)).to.eq(getBigNumber(1))
    })

    it('Increases total supply', async () => {
      await fem.mint(owner.address, getBigNumber(1))
      expect(await fem.totalSupply()).to.eq(getBigNumber(1))
    })

    it('Checkpoints delegation', async () => {
      await fem.mint(owner.address, getBigNumber(1))
      await fem.delegate(notOwner.address)
      await fem.mint(owner.address, getBigNumber(1))
      const blockNumber = await ethers.provider.getBlockNumber()
      await advanceBlock()
      expect(await fem.getPastVotes(notOwner.address, blockNumber)).to.eq(getBigNumber(2))
    })
  })

  describe('burn', () => {
    it('Reverts if not called by owner', async () => {
      await expect(fem.connect(notOwner).burn(owner.address, getBigNumber(1)))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('Decreases balance', async () => {
      await fem.mint(owner.address, getBigNumber(2))
      expect(await fem.balanceOf(owner.address)).to.eq(getBigNumber(2))
      await fem.burn(owner.address, getBigNumber(1))
      expect(await fem.balanceOf(owner.address)).to.eq(getBigNumber(1))
    })

    it('Decreases total supply', async () => {
      await fem.mint(owner.address, getBigNumber(2))
      expect(await fem.totalSupply()).to.eq(getBigNumber(2))
      await fem.burn(owner.address, getBigNumber(1))
      expect(await fem.totalSupply()).to.eq(getBigNumber(1))
    })

    it('Checkpoints delegation', async () => {
      await fem.mint(owner.address, getBigNumber(2))
      await fem.delegate(notOwner.address)
      await fem.burn(owner.address, getBigNumber(1))
      const blockNumber = await ethers.provider.getBlockNumber()
      await advanceBlock()
      expect(await fem.getPastVotes(notOwner.address, blockNumber)).to.eq(getBigNumber(1))
    })
  })
})