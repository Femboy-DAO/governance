# FemboyDAO Erecter

FemboyDAO is deployed through a time-limited ETH fundraise with a minimum ETH value that must be raised and no maximum.

During the sale, FEM tokens are immediately distributed to depositors in exchange for ETH at a rate of 1:1.

The FemErecter sale contract tracks the amount of ETH deposited by each account. This can then be used to determine mint whitelists for NFTs.

After the successful sale, the Governess contract is activated, making FEM a voting token for the Femboy DAO.

The DAO then has until {spendDeadline} to claim the ETH from the sale, presumably upon acceptance of a bid from an artist to create a collection.

If the sale fails to raise sufficient ETH, or if the DAO does not claim the ETH before the deadline, FEM can be redeemed for ETH on the FemErecter contract.

## Governess Activation

Governess is deployed by GovernessActivator.

GovernessActivator is set as the timelock address on Governess so that it can control the governance settings, with a proposal threshold of 2**256-1 so that FEM holders can not create proposals. At the same time, GovernessActivator deploys OpenZeppelin's TimelockController with Governess set as the only approved proposer.

FemErecter is deployed with TimelockController as its owner, so that the ETH can only ever be claimed by a successful governance vote.

Upon a successful sale, GovernessActivator changes the proposal threshold on Governess to 1% of the total FEM supply and changes the timelock address to TimelockController so that proposals can be queued in TimelockController.

At no point does any externally controlled wallet have privileged access to any features of governance or ability to claim ETH from the sale.

This process ensures that:
- Early depositors can not affect future governance before the sale is over.
- ETH can not possibly be claimed except by a successful governance vote following a successful sale.
- ETH can be reclaimed by FEM holders if the sale fails or if governance fails to claim the ETH.


## Scripts

`yarn test`

Runs all tests in `test/`

`yarn coverage`

Runs all tests with solidity-coverage and generates a coverage report.

`yarn compile`

Compiles artifacts into `artifacts/` and generates typechain interfaces in `typechain/`

`yarn lint`

Runs solhint against the contracts.
