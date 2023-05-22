import {ImageAnnotatorClient} from '@google-cloud/vision';
import AWS from 'aws-sdk';
import axios from 'axios';

/** DB 조회 **/
export async function queryMySQL(connection: any, query: string, values: any): Promise<any> {
    try {
        const [rows] = await connection.execute(query, values);
        return rows;
    } catch (error) {
        throw error;
    }
}

/** Google Vision API **/
export async function callVisionAPI(imageUrl: string): Promise<object>{
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
export async function isReceipt(imageBuffer): Promise<boolean>{
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

/** GPT API 주소 추출 **/
export async function addressExtract(text: string): Promise<string>{
    let extractedAddress: string = '';
    const GPT_API_KEY = process.env.GPT_API_KEY;
    const response = await axios.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
        prompt: text,
        max_tokens: 100,
        temperature: 0.7
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GPT_API_KEY}`
        }
    });

    return response.data.choices[0].text.trim();
}

