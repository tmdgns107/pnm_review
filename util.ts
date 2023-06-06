import {ImageAnnotatorClient} from '@google-cloud/vision';
import AWS from 'aws-sdk';
import axios from 'axios';
import {APIGatewayProxyResultV2} from "aws-lambda";
import mysql from 'mysql2/promise';

export async function getConnection(alias: string): Promise<mysql.Connection> {
    let connection: mysql.Connection;
    try{
        connection = await mysql.createConnection({
            host: process.env[`${alias.toUpperCase()}_DB_HOST`],
            user: process.env[`${alias.toUpperCase()}_DB_USER`],
            password: process.env[`${alias.toUpperCase()}_DB_PASSWORD`],
            port: 3306,
            database: process.env[`${alias.toUpperCase()}_DB_NAME`]
        });

        return connection;
    }catch (e) {
        console.log("Error in getConnection", e);
        return connection;
    };
}

/** DB 쿼리 실행 **/
export async function queryMySQL(dbConnection: any, query: string, values: any): Promise<any> {
    try {
        const [rows] = await dbConnection.execute(query, values);
        return rows;
    } catch (error) {
        throw error;
    }
}

/** Google Vision API **/
export async function callVisionAPI(imageUrl: string): Promise<any>{
    try{
        /** GCP Client connect **/
        const client = new ImageAnnotatorClient({
            credentials: JSON.parse(process.env.GCP_CREDENTIALS) // 키 파일 경로
        });

        /** call vision api **/
        const [result] = await client.textDetection(imageUrl);

        /** textAnnotations 값이 없다면 오류처리 **/
        if(!result.textAnnotations || (result.textAnnotations && result.textAnnotations.length === 0)){
            return {
                message: 'Text could not be verified.'
            };
        }
        const detections = result.textAnnotations;
        return {
            text: detections[0].description
        };
    }catch (e) {
        console.log("Error in callVisionAPI", e);
        return e;
    }
}

/** 영수증 사진인지 확인 **/
export async function isReceipt(imageBuffer: Buffer): Promise<boolean>{
    try{
        const rekognition = new AWS.Rekognition();
        const params = {
            Image: {
                Bytes: imageBuffer
            }
        };

        const detectText = await rekognition.detectText(params).promise();
        const textDetections = detectText.TextDetections;
        console.log("detectText in isReceipt", textDetections);

        const receipts = textDetections.filter(detection => detection.Confidence >= 80 && detection.DetectedText.toLowerCase().includes('receipt'));
        if (receipts.length > 0) {
            console.log('There is a receipt in the image.');
            return true;
        } else {
            console.log('There is no receipt in the image.');
            return false;
        }
    }catch (e) {
        console.log("Error in isReceipt", e);
        return false;
    }
}

/** GPT API 주소 추출 -> 사용하지 않음 **/
export async function addressExtractByGPT(text: string): Promise<any>{
    try{
        const GPT_API_KEY: string = process.env.GPT_API_KEY;
        const response = await axios.post(
            'https://api.openai.com/v1/engines/davinci/completions',
            {
                prompt: `Extract the address from the following text:\n${text}`,
                max_tokens: 100,
                temperature: 0.7,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${GPT_API_KEY}`,
                },
            }
        );

        console.log("addressExtractByGPT response", response.data);
        if(!response.data || (response.data && !response.data.choices) || (response.data && response.data.choices && response.data.choices.length === 0)) {
            console.log("Not exist response.data.choices");
            return false;
        }

        return response.data.choices[0].text.trim();
    }catch (e) {
        console.log("Error in addressExtract", e);
        return false;
    }
}

/** URL을 Buffer 데이터로 변환 **/
export async function imageUrlToBuffer(imageUrl): Promise<Buffer> {
    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
        });

        const imageBuffer: Buffer = Buffer.from(response.data, 'binary');
        return imageBuffer;
    } catch (error) {
        console.log('Error in imageUrlToBuffer:', error);
        return null;
    }
}

