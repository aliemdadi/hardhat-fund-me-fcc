// const { ethers, getNamedAccounts } = require("hardhat")
const { ethers } = require("hardhat")

// async function main() {
//   const { deployer } = await getNamedAccounts()
//   const fundMe = await ethers.getContract("FundMe", deployer)
//   console.log(`Got contract FundMe at ${fundMe.address}`)
//   console.log("Funding contract...")
//   const transactionResponse = await fundMe.fund({
//     value: ethers.utils.parseEther("0.1"),
//   })
//   await transactionResponse.wait()
//   console.log("Funded!")
// }
async function main() {
    const FundMeFactory = await ethers.getContractFactory("FundMe")
    console.log("Deploying contract...")
    const fundMe = await FundMeFactory.deploy(
        "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    )
    await fundMe.deployed()
    console.log(`Deployed contract to: ${fundMe.address}`)
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
