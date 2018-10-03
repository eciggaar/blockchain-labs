package main

import (
	"fmt"
	"strconv"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	"encoding/json"
)

type SimpleChaincode struct {
}

type Wallet struct {
	UserID              string   `json:"userID"`
	AccountID           string   `json:"accountID"`
	AssetID             string   `json:"assetID"`
	AssetTitle          string   `json:"assetTitle"`
	AssetIssuedQuantity int64    `json:"assetIssuedQuantity"`
	AssetMyQuantity     int64    `json:"assetMyQuantity"`
	Shareholders        []string `json:"shareholders"`
	Issuer              string   `json:"issuer"`
	Status              string   `json:"status"`
}

const (
	ASSET_ISSUED = "ISSUED"
	ASSET_APPROVED = "APPROVED"
	ASSET_TRADED = "TRADED"
)

func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	fmt.Println("Private chaincode initialized")
	return shim.Success(nil)
}

func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	fmt.Println("Private chaincode invoke")
	function, args := stub.GetFunctionAndParameters()
	fmt.Println("Called function " + function)
	fmt.Printf("With args: %v \n", args)
	fmt.Println("TransactionID: " + stub.GetTxID())

	if function == "issueAsset" {
		return t.issueAsset(stub, args)
	} else if function == "approveAsset" {
		return t.approveAsset(stub, args)
	} else if function == "updateBalance" {
		return t.updateBalance(stub, args)
	} else if function == "query" {
		return t.query(stub, args)
	}

	return shim.Error("Invalid invoke function name")
}

func (t *SimpleChaincode) issueAsset(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	fmt.Println("inside issue asset function")
	fmt.Println(args)

	var wallet Wallet
	err := json.Unmarshal([]byte(args[0]), &wallet)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}
	fmt.Println(wallet)

	wallet.Status = ASSET_ISSUED

	walletAsBytes, err := json.Marshal(wallet)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	err = stub.PutState(wallet.UserID, walletAsBytes)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	fmt.Println("Succesfully stored the asset wallet!")

	return shim.Success(nil)
}

func (t *SimpleChaincode) approveAsset(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	fmt.Println("inside approve asset function")
	fmt.Println(args)

	walletAsBytes, err := stub.GetState(args[0])
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	var wallet Wallet
	err = json.Unmarshal(walletAsBytes, &wallet)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	wallet.Status = ASSET_APPROVED

	walletAsBytes, err = json.Marshal(wallet)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	err = stub.PutState(wallet.UserID, walletAsBytes)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	fmt.Println("Succesfully approved the asset!")

	return shim.Success(nil)
}

func (t *SimpleChaincode) updateBalance(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	fmt.Println("inside update balance function")
	fmt.Println(args)

	walletAsBytes, err := stub.GetState(args[0])
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	var wallet Wallet
	err = json.Unmarshal(walletAsBytes, &wallet)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	wallet.Shareholders = append(wallet.Shareholders, args[1])

	transfer, err := strconv.ParseInt(args[2], 10, 64)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	if wallet.AssetMyQuantity < transfer {
		fmt.Printf("Not enough balance to complete the transfer: %d availableQuantity | %d transferRequest", wallet.AssetMyQuantity, transfer)
		return shim.Error("Not enough balance to complete the transfer")
	}

	wallet.AssetMyQuantity -= transfer

	wallet.Status = ASSET_TRADED

	walletAsBytes, err = json.Marshal(wallet)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	err = stub.PutState(wallet.UserID, walletAsBytes)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	fmt.Println("Succesfully updated the asset balance!")

	return shim.Success(nil)
}

// query callback representing the query of a chaincode
func (t *SimpleChaincode) query(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var A string // Entities
	var err error

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting name of the person to query")
	}

	A = args[0]

	// Get the state from the ledger
	Avalbytes, err := stub.GetState(A)
	if err != nil {
		jsonResp := "{\"Error\":\"Failed to get state for " + A + "\"}"
		return shim.Error(jsonResp)
	}

	if Avalbytes == nil {
		jsonResp := "{\"Error\":\"Nil amount for " + A + "\"}"
		return shim.Error(jsonResp)
	}

	jsonResp := "{\"Name\":\"" + A + "\",\"Amount\":\"" + string(Avalbytes) + "\"}"
	fmt.Printf("Query Response:%s\n", jsonResp)
	return shim.Success(Avalbytes)
}

func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode: %s", err)
	}
}
