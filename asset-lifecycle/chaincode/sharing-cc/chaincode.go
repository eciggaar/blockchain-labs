package main

import (
	"fmt"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	"encoding/json"
	"strconv"
	"errors"
)

type SimpleChaincode struct {
}

type Asset struct {
	AssetID                string   `json:"assetID"`
	AssetTitle             string   `json:"assetTitle"`
	AssetAvailableQuantity int64    `json:"assetAvailableQuantity"`
}

var AssetIndexName = "_asset"

func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	fmt.Println("Sharing chaincode initialized")

	var emptyIndex []string

	empty, err := json.Marshal(emptyIndex)
	if err != nil {
		return shim.Error("Error marshalling")
	}

	err = stub.PutState(AssetIndexName, empty);
	if err != nil {
		return shim.Error("Error deleting index")
	}

	return shim.Success(nil)
}

func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	fmt.Println("Sharing chaincode invoke")
	function, args := stub.GetFunctionAndParameters()
	fmt.Println("Called function " + function)
	fmt.Printf("With args: %v \n", args)
	fmt.Println("TransactionID: " + stub.GetTxID())

	if function == "createAsset" {
		return t.createAsset(stub, args)
	} else if function == "updateAsset" {
		return t.updateAsset(stub, args)
	} else if function == "getAllAssets" {
		return t.getAllAssets(stub, args)
	} else if function == "query" {
		return t.query(stub, args)
	}

	return shim.Error("Invalid invoke function name")
}

func (t *SimpleChaincode) createAsset(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	fmt.Println("inside create asset function")
	fmt.Println(args)

	var asset Asset
	err := json.Unmarshal([]byte(args[0]), &asset)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}
	fmt.Println(asset)

	assetAsBytes, err := json.Marshal(asset)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	err = stub.PutState(asset.AssetID, assetAsBytes)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	index, err := GetIndex(stub, AssetIndexName)
	if err != nil {
		return shim.Error(err.Error())
	}

	index = append(index, asset.AssetID)

	jsonAsBytes, err := json.Marshal(index)
	if err != nil {
		return shim.Error("Error marshalling index '" + AssetIndexName + "': " + err.Error())
	}

	err = stub.PutState(AssetIndexName, jsonAsBytes)
	if err != nil {
		return shim.Error("Error storing new " + AssetIndexName + " into ledger")
	}

	fmt.Println("Succesfully stored the asset!")

	return shim.Success(nil)
}

func (t *SimpleChaincode) updateAsset(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	fmt.Println("inside update asset function")
	fmt.Println(args)

	assetAsBytes, err := stub.GetState(args[0])
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	var asset Asset
	err = json.Unmarshal(assetAsBytes, &asset)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	transfer, err := strconv.ParseInt(args[1], 10, 64)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	if asset.AssetAvailableQuantity < transfer {
		fmt.Printf("It is not possible to have negative balance: %d availableQuantity | %d transferRequest", asset.AssetAvailableQuantity, transfer)
		return shim.Error("It is not possible to have negative balance")
	}

	asset.AssetAvailableQuantity -= transfer

	assetAsBytes, err = json.Marshal(asset)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	err = stub.PutState(asset.AssetID, assetAsBytes)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	fmt.Println("Succesfully stored the updated asset!")

	return shim.Success(nil)
}

func (t *SimpleChaincode) getAllAssets(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	assetIndex, err := GetIndex(stub, AssetIndexName)
	if err != nil {
		return shim.Error(err.Error())
	}

	assets := []Asset{}

	for _, assetID := range assetIndex {
		assetAsBytes, err := stub.GetState(assetID)
		if err != nil {
			return shim.Error(err.Error())
		}

		asset := Asset{}

		err = json.Unmarshal(assetAsBytes, &asset)
		if err != nil {
			return shim.Error(err.Error())
		}

		assets = append(assets, asset)
	}

	assetAsBytes, err := json.Marshal(assets)
	if err != nil {
		fmt.Println(err)
		return shim.Error(err.Error())
	}

	return shim.Success(assetAsBytes)
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

func GetIndex(stub shim.ChaincodeStubInterface, indexName string) ([]string, error) {
	indexAsBytes, err := stub.GetState(indexName)
	if err != nil {
		return nil, errors.New("Failed to get " + indexName)
	}

	var index []string
	err = json.Unmarshal(indexAsBytes, &index)
	if err != nil {
		return nil, errors.New("Error unmarshalling index '" + indexName + "': " + err.Error())
	}

	return index, nil
}