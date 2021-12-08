const express = require('express');
const app = express();
const port = 3000;
const path = require("path");
let publicPath = path.resolve(__dirname,"public");
app.use(express.static(publicPath));

var aws = require("aws-sdk");
var s3 = new aws.S3();

aws.config.update({
  region: "eu-west-1",
});

var dynamodb = new aws.DynamoDB();
var docClient = new aws.DynamoDB.DocumentClient();
var movieData;

var objectParams = {
    Bucket: "csu44000assignment220", 
    Key: "moviedata.json"
};

var params = {
    TableName : "Movies",
    KeySchema: [       
        { AttributeName: "year", KeyType: "HASH"},  //Partition key
        { AttributeName: "title", KeyType: "RANGE" }  //Sort key
    ],
    AttributeDefinitions: [       
        { AttributeName: "year", AttributeType: "N" },
        { AttributeName: "title", AttributeType: "S" }
    ],
    ProvisionedThroughput: {       
        ReadCapacityUnits: 1, 
        WriteCapacityUnits: 1
    }
};

app.get("/createDatabase", (req, res) => {
    dynamodb.createTable(params, function(err, data) {
        if (err) 
            console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
        else {
            console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
            console.log("Please wait for table to be populated...");
            s3.getObject(objectParams, function(err, data) {
                if (err)
                    console.log("Error", err);
                else {
                    movieData = JSON.parse(data.Body);
                    movieData.forEach(function(movie){
                        var movieParams = {
                            TableName: "Movies",
                            Item: {
                                "year": movie.year,
                                "title": movie.title,
                                "info": movie.info
                            }
                        };
                
                        docClient.put(movieParams, function(err, data) {
                            if (err) {
                                console.log("Unable to add movie ", movie.title, ". Error JSON:", JSON.stringify(err, null, 2));   
                            }
                        });
                    });
                    console.log("Data added.");
                    res.send(data);
                }
            });
        };
    });
});

app.get("/queryDatabase/:year/:title", (req, res) => {
    let title = req.params.title;
    let year = parseInt(req.params.year);
    let results = [];
    console.log("Querying for movies from " + year + " starting with " + title + "...");

    params = {
        TableName : "Movies",
        KeyConditionExpression: "#yr = :yyyy and begins_with(title, :name)",
        ExpressionAttributeNames:{
            "#yr": "year"
        },
        ExpressionAttributeValues: {
            ":yyyy": year,
            ":name" : title
        }
    };

    docClient.query(params, function(err, data) {
        if (err) 
            console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
        else {
            console.log("Query succeeded.");
            data.Items.forEach(function(item) {
                console.log(" -", item.year + ": " + item.title);
                results.push(item)
            });
            for (let i = 0; i < results.length; i++)
                console.log(results[i]);
            res.send(results);
        }
    });
})


app.get("/deleteDatabase", (req, res) => {
    params = {
        TableName : "Movies"
    };
    dynamodb.deleteTable(params, function(err, data) {
        if (err) {
            console.error("Unable to delete table. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Deleted table. Table description JSON:", JSON.stringify(data, null, 2));
        }
    });
})

app.listen(port, () => console.log('App listening on port', port))
