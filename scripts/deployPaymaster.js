async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const Paymaster = await ethers.getContractFactory("SimplePaymaster");
  const paymaster = await Paymaster.deploy("0xEntryPointContractAddress");

  console.log("Paymaster deployed to:", paymaster.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
