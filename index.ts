// import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Handler } from 'aws-lambda';
import { APIGatewayProxyResultV2 } from 'aws-lambda';
import * as util from "./util";
// import { stringSimilarity } from "string-similarity-js";
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

app.get('/', async (req: Request, res: Response) => {
    let connection: any;
    try {
        let alias: string = 'dev';
        let reviewTableName: string = 'reviews_test';
        if (req.baseUrl.includes('/prod/') || req.baseUrl.includes('/live/')) {
            alias = 'prod';
            reviewTableName = 'reviews';
        }

        // Validate required query parameter
        const id = req.query.id;
        if (!id) {
            console.log("id is required.");
            return res.status(400).json({ errorCode: 102, items: [], message: 'id is required.' });
        }

        connection = await util.getConnection(alias);

        const searchQuery: string = `SELECT * FROM ${reviewTableName} USE INDEX (fk_hospitalId) WHERE hospitalId = ?;`;
        console.log("searchQuery", searchQuery);

        const reviews = await util.queryMySQL(connection, searchQuery, [id]);
        console.log("reviews", reviews);

        res.json({ message: 'success', items: reviews });
    } catch (e) {
        console.log("Error in db connection", e);
        res.status(500).json({ errorCode: 201, items: [], message: 'An error occurred while executing the query.' });
    } finally {
        if (connection) {
            connection.end();
        }
    }
});


/** 결과 리턴 함수 **/
export function sendResponse(errorCode: number, items: any[], message: string): object{
    let response: APIGatewayProxyResultV2 = {
        statusCode: 200,
        body: ''
    };
    let responseBody: { message: string; errorCode: number, Items: any[]};
    responseBody = {
        message: '',
        errorCode: null,
        Items: []
    };

    if(errorCode)
        response.statusCode = 400;
    responseBody.message = message;
    responseBody.errorCode = errorCode;
    responseBody.Items = items;
    response.body = JSON.stringify(responseBody);
    return response;
}