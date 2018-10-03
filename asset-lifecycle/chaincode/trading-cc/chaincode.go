package main

import (
	"fmt"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	"encoding/json"
)

type SimpleChaincode struct {
}

type Transaction struct {
	TransactionID   string `json:"transactionID"`
	SellerAccount   string `json:"sellerAccount"`
	ReceiverAccount string `json:"receiverAccount"`
	Amount          int64  `json:"amount"`
	AssetID         string `json:"assetID"`
	AssetTitle      string `json:"assetTitle"`
	Timestamp       int64  `json:"timestamp"`
}

func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	fmt.Println("Trading chaincode initialized")
	return shim.Success(nil)
}

func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	fmt.Println("Trading chaincode invoke")
	function, args := stub.GetFunctionAndParameters()
	fmt.Println("Called function " + function)
	fmt.Printf("With args: %v \n", args)
	fmt.Println("TransactionID: " + stub.GetTxID())

	if function == "transfer" {
		return t.transfer(stub, args)
	} else if function == "query" {
		return t.query(stub, args)
	}

	return shim.Error("Invalid invoke function name")
}

func (t *SimpleChaincode) transfer(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	fmt.Println("inside create transaction function")
	fmt.Println(args)

	var transaction Transaction
	err := json.Unmarshal([]byte(args[0]), &transaction)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}
	fmt.Println(transaction)

	transactionAsBytes, err := json.Marshal(transaction)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	err = stub.PutState(transaction.TransactionID, transactionAsBytes)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	fmt.Println("Succesfully stored the transaction!")

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