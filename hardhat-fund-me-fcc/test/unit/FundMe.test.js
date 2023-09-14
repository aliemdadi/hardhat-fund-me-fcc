const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const {
    developmentChains,
    getNamedAccounts,
} = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", function () {
          let fundMe
          let mockV3Aggregator
          let deployer
          const sendValue = ethers.utils.parseEther("1")
          beforeEach(async () => {
              // const accounts = await ethers.getSigners()
              // deployer = accounts[0]
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              fundMe = await ethers.getContract("FundMe", deployer)
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer,
              )
          })

          describe("constructor", function () {
              it("sets the aggregator addresses correctly", async () => {
                  const response = await fundMe.getPriceFeed()
                  assert.equal(response, mockV3Aggregator.address)
              })
          })

          describe("fund", function () {
              // https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
              // could also do assert.fail
              it("Fails if you don't send enough ETH", async () => {
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "You need to spend more ETH!",
                  )
              })
              // we could be even more precise here by making sure exactly $50 works
              // but this is good enough for now
              it("Updates the amount funded data structure", async () => {
                  await fundMe.fund({ value: sendValue })
                  const response =
                      await fundMe.getAddressToAmountFunded(deployer)
                  assert.equal(response.toString(), sendValue.toString())
              })
              it("Adds funder to array of funders", async () => {
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getFunder(0)
                  assert.equal(response, deployer)
              })
              it("Allows multiple funders and updates balances", async () => {
                  const accounts = await ethers.getSigners()
                  const sendValueHalf = ethers.utils.parseEther("0.5")

                  await fundMe.fund({ value: sendValue })
                  await fundMe
                      .connect(accounts[1])
                      .fund({ value: sendValueHalf })
                  await fundMe
                      .connect(accounts[2])
                      .fund({ value: sendValueHalf })

                  const balanceDeployer =
                      await fundMe.getAddressToAmountFunded(deployer)
                  const balanceAccount1 = await fundMe.getAddressToAmountFunded(
                      accounts[1].address,
                  )
                  const balanceAccount2 = await fundMe.getAddressToAmountFunded(
                      accounts[2].address,
                  )

                  assert.equal(balanceDeployer.toString(), sendValue.toString())
                  assert.equal(
                      balanceAccount1.toString(),
                      sendValueHalf.toString(),
                  )
                  assert.equal(
                      balanceAccount2.toString(),
                      sendValueHalf.toString(),
                  )
              })
          })

          describe("withdraw", function () {
              beforeEach(async () => {
                  await fundMe.fund({ value: sendValue })
              })
              it("withdraws ETH from a single funder", async () => {
                  // Arrange
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)

                  // Act
                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait()
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address,
                  )
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)

                  // Assert
                  // Maybe clean up to understand the testing
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerBalance.add(gasCost).toString(),
                  )
              })
              // this test is overloaded. Ideally we'd split it into multiple tests
              // but for simplicity we left it as one
              it("it allows us to withdraw with multiple funders", async () => {
                  // Arrange
                  const accounts = await ethers.getSigners()
                  for (i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i],
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)

                  // Act
                  const transactionResponse = await fundMe.cheaperWithdraw()
                  // Let's comapre gas costs :)
                  // const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait()
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const withdrawGasCost = gasUsed.mul(effectiveGasPrice)
                  console.log(`GasCost: ${withdrawGasCost}`)
                  console.log(`GasUsed: ${gasUsed}`)
                  console.log(`GasPrice: ${effectiveGasPrice}`)
                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address,
                  )
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  // Assert
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerBalance.add(withdrawGasCost).toString(),
                  )
                  // Make a getter for storage variables
                  await expect(fundMe.getFunder(0)).to.be.reverted

                  for (i = 1; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address,
                          ),
                          0,
                      )
                  }
              })
              it("Only allows the owner to withdraw", async function () {
                  const accounts = await ethers.getSigners()
                  const fundMeConnectedContract = await fundMe.connect(
                      accounts[1],
                  )
                  await expect(
                      fundMeConnectedContract.withdraw(),
                  ).to.be.revertedWith("FundMe__NotOwner")
              })
          })
          describe("updateMinimumUSD", function () {
              it("allows the owner to update the minimumUSD value", async () => {
                  // Arrange
                  const newMinimumUSD = ethers.utils.parseEther("0.7") // Set a new minimumUSD value

                  // Act
                  await fundMe.updateMinimumUSD(newMinimumUSD)

                  // Assert
                  const updatedMinimumUSD = await fundMe.minimumUSD()
                  assert.equal(
                      updatedMinimumUSD.toString(),
                      newMinimumUSD.toString(),
                  )
              })

              it("reverts when a non-owner tries to update the minimumUSD value", async () => {
                  // Arrange
                  const newMinimumUSD = ethers.utils.parseEther("2") // Set a new minimumUSD value
                  const accounts = await ethers.getSigners()
                  const nonOwner = accounts[1]

                  // Act and Assert
                  const fundMeConnectedContract = await fundMe.connect(nonOwner)
                  await expect(
                      fundMeConnectedContract.updateMinimumUSD(newMinimumUSD),
                  ).to.be.revertedWith("FundMe__NotOwner")
              })
          })
      })
