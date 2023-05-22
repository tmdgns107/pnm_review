import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Handler } from 'aws-lambda';
import mysql from 'mysql2/promise';
import * as util from "./util";

export const handler: Handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResultV2> => {
    console.log("Event", event);

    let alias: string = 'dev';
    let tableName: string = 'review_test';
    if(event.requestContext.path.includes('/prod/') || event.requestContext.path.includes('/live/')) {
        alias = 'prod';
        tableName = 'hp_review';
    }

    let response: APIGatewayProxyResultV2 = {
        statusCode: 200,
        body: ''
    };
    let responseBody: { message: string; userInfo: object };
    responseBody = {
        message: '',
        userInfo: {}
    };

    let connection;
    try {
        /** MySQL 연결 **/
        connection = await mysql.createConnection({
            host: process.env[`${alias.toUpperCase()}_DB_HOST`],
            user: process.env[`${alias.toUpperCase()}_DB_USER`],
            password: process.env[`${alias.toUpperCase()}_DB_PASSWORD`],
            port: 3306,
            database: process.env[`${alias.toUpperCase()}_DB_NAME`]
        });


        return response;
    } catch (e) {
        console.log("Error in db connection", e);
        response.statusCode = 400;
        responseBody.message = 'An error occurred while executing the query.';
        responseBody.userInfo = {};
        response.body = JSON.stringify(responseBody);
        return response;
    } finally {
        if (connection) {
            connection.end();
        }
    }
};
