import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Handler } from 'aws-lambda';
import * as util from "./util";
import mysql from "mysql2/promise";
import { stringSimilarity } from "string-similarity-js";

export const handler: Handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResultV2> => {
    console.log("Event", event);

    let alias: string = 'dev';
    if(event.requestContext.path.includes('/prod/') || event.requestContext.path.includes('/live/')) {
        alias = 'prod';
    }

    // GET 요청 처리
    if (event.httpMethod === 'GET') {
        return handleGetRequest(alias, event);
    }

    // POST 요청 처리
    if (event.httpMethod === 'POST') {
        return handlePostRequest(alias, event);
    }

    // 지원되지 않는 HTTP 메서드일 경우 에러 응답 반환
    return sendResponse(400, [], 'Unsupported HTTP method');
};

async function handleGetRequest(alias: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResultV2> {
    /** GET 요청 처리 로직 작성 **/
    let connection: mysql.Connection;
    try{
        let reviewTableName: string = 'reviews_test';
        if(alias === 'prod') {
            reviewTableName = 'reviews';
        }

        const { id, sidoNm, sigunNm, dongNm } = event.queryStringParameters;

        let searchQuery: string, values: any[]
        if (id) {
            searchQuery = `SELECT * FROM ${reviewTableName} WHERE id = ?`;
            values = [id];
        } else {
            let whereClause: string = "(status <> '폐업')";
            if (sigunNm && dongNm) {
                whereClause += " AND (lotNoAddr LIKE CONCAT('%', ?, '%')) AND (sigunNm = ?)";
                values = [dongNm, sigunNm];
            } else if (sigunNm) {
                whereClause += " AND (sigunNm = ?)";
                values = [sigunNm];
            } else if (sidoNm) {
                whereClause += " AND (sidoNm = ?)";
                values = [sidoNm];
            } else {
                console.log("The search parameter is required.");
                return sendResponse(102, [], 'The search parameter is required.');
            }
            searchQuery = `SELECT id, sidoNm, sigunNm, bizPlcNm, roadNmAddr, lotNoAddr, lat, lng FROM ${reviewTableName} WHERE ${whereClause}`;
        }

        console.log("searchQuery", searchQuery);
        console.log("values", values);

        connection = await util.getConnection(alias);
        const items = await util.queryMySQL(connection, searchQuery, values);
        console.log("Search items", items);

        return sendResponse(null, items, 'success');
    }catch (e) {
        console.log("Error in get the review data", e);
        return sendResponse(101, [], 'An error occurred while executing the query.');
    }finally {
        if (connection)
            await connection.end();
    }

}

async function handlePostRequest(alias: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResultV2> {
    /** POST 요청 처리 로직 작성 **/
    let connection: mysql.Connection;
    try {
        let reviewTableName: string = 'reviews_test';
        let hospitalTableName: string = 'hospitals_test';
        if (alias === 'prod') {
            reviewTableName = 'reviews';
            hospitalTableName = 'hospitals';
        }

        let body: any = JSON.parse(event.body);
        const { receiptImage, id, userId } = body;
        if(!receiptImage || !id || !userId){
            console.log("receiptImage, id are required.");
            return sendResponse(202, [], 'receiptImage, id are required.');
        }

        const imageBuffer: Buffer = await util.imageUrlToBuffer(alias, receiptImage);
        if(!imageBuffer){
            console.log("Failed to convert image file to buffer data.");
            return sendResponse(203, [], 'Failed to convert image file to buffer data.');
        }
        const isReceipt: boolean = await util.isReceipt(imageBuffer);

        if(!isReceipt){
            console.log("Image is not a receipt file.");
            return sendResponse(204, [], 'Image is not a receipt file.');
        }

        connection = await util.getConnection(alias);

        /** 병원정보 가져오기 및 vision api 호출 **/
        const searchQuery: string = `SELECT * FROM ${hospitalTableName} WHERE id = ?`;
        const visionAPIResult = await util.callVisionAPI(imageBuffer);
        const hospitalResult = await util.queryMySQL(connection, searchQuery, [id]);
        // let [hospitalResult, visionAPIResult] = await Promise.all([
        //     util.queryMySQL(connection, searchQuery, [id]),
        //     util.callVisionAPI(imageBuffer)
        // ]);

        console.log("hospitalResult", hospitalResult);
        console.log("visionAPIResult", visionAPIResult);

        if(hospitalResult.length === 0){
            console.log("Hospital information could not be found.");
            return sendResponse(205, [], 'Hospital information could not be found.');
        }
        if(visionAPIResult.message){
            console.log("An error occurred while requesting the vision api.");
            return sendResponse(206, [], 'An error occurred while requesting the vision api.');
        }

        const visionAPI = visionAPIResult.text;
        const visionAPIArr = visionAPI.split('\n');

        console.log("visionAPIArr", visionAPIArr);

        const doName: string[] = ['경기도'];
        let addressArr: string[] = [];
        for (let text of visionAPIArr) {
            if (doName.some(doItem => text.includes(doItem))) {
                addressArr.push(text);
            }
        }

        console.log("addressArr", addressArr);

        const lotNoAddr = hospitalResult[0].lotNoAddr;
        const roadNmAddr = hospitalResult[0].roadNmAddr;

        let isSimilarAddress: boolean = false;
        for (let addr of addressArr) {
            let lotNoAddrSimilarity: number = lotNoAddr ? stringSimilarity(addr, lotNoAddr) : 0;
            let roadNmAddrSimilarity: number = roadNmAddr ? stringSimilarity(addr, roadNmAddr) : 0;

            console.log("lotNoAddrSimilarity", lotNoAddrSimilarity);
            console.log("roadNmAddrSimilarity", roadNmAddrSimilarity);

            if (lotNoAddrSimilarity >= 0.75 || roadNmAddrSimilarity >= 0.75) {
                isSimilarAddress = true;
                break;
            }
        }

        if(!isSimilarAddress){
            console.log("The address on the receipt and the address of the veterinary clinic do not match.");
            return sendResponse(207, [], 'The address on the receipt and the address of the veterinary clinic do not match.');
        }

        const currentTime: string = new Date().toISOString();
        let insertValues: any[] = [id, userId, body.rate, body.comment, receiptImage, body.treatmentNm, currentTime, currentTime];
        let insertQuery: string = `INSERT INTO ${reviewTableName} (hospitalId, userId, rate, comment, imageUrl, treatmentNm, createTime, updateTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        console.log("insertValues", insertValues);
        console.log("insertQuery", insertQuery);

        let updateValues: any[] = [id];
        let updateQuery: string;
        const rate: number = Number(body.rate);
        const hospitalRate: number = hospitalResult[0].rate ? Number(hospitalResult[0].rate) : 0;
        const hospitalReviewCount: number = hospitalResult[0].reviewCount ? Number(hospitalResult[0].reviewCount) : 0;
        if(hospitalRate && hospitalReviewCount){
            let updatedRate: number = Number((((hospitalRate * hospitalReviewCount) + rate) / (hospitalReviewCount + 1)).toFixed(2));
            updateQuery = `UPDATE ${hospitalTableName} SET updateTime = '${currentTime}', rate = ${updatedRate}, reviewCount = ${hospitalReviewCount+1} WHERE id = ?`;
        }else{
            updateQuery = `UPDATE ${hospitalTableName} SET updateTime = '${currentTime}', rate = ${rate}, reviewCount = ${1} WHERE id = ?`;
        }
        console.log("updateValues", updateValues);
        console.log("updateQuery", updateQuery);

        await Promise.all([
            util.queryMySQL(connection, insertQuery, insertValues),
            util.queryMySQL(connection, updateQuery, updateValues)
        ]);

        return sendResponse(null, [], 'success');
    }catch (e) {
        console.log("Error in insert the review data", e);
        return sendResponse(201, [], 'An error occurred while executing the query.');
    }finally {
        if(connection)
            await connection.end();
    }
}


/** 결과 리턴 함수 **/
function sendResponse(errorCode: number, items: any[], message: string): object{
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