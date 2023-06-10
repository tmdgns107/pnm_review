# Lambda Function with MySQL and Google Cloud Vision API Integration

This repository contains an AWS Lambda function written in TypeScript that integrates with MySQL database and Google Cloud Vision API for text detection in receipt images.

## Prerequisites

To run this Lambda function, you need the following:

- An AWS account
- AWS CLI configured with appropriate credentials
- Node.js and npm installed locally
- MySQL database instance
- Google Cloud Vision API credentials

## Getting Started

1. Clone this repository:

```
git clone https://github.com/tmdgns107/pnm_review.git
```


2. Install dependencies by running the following command in the project root directory:
```
npm install
```


3. Set up the AWS environment variables:

   - `AWS_ACCESS_KEY_ID`: AWS access key ID with Lambda function execution permission
   - `AWS_SECRET_ACCESS_KEY`: AWS secret access key corresponding to the access key ID

4. Set up the MySQL environment variables:

   - `DEV_DB_HOST`: Development MySQL database host
   - `DEV_DB_USER`: Development MySQL database username
   - `DEV_DB_PASSWORD`: Development MySQL database password
   - `DEV_DB_NAME`: Development MySQL database name

   - `PROD_DB_HOST`: Production MySQL database host
   - `PROD_DB_USER`: Production MySQL database username
   - `PROD_DB_PASSWORD`: Production MySQL database password
   - `PROD_DB_NAME`: Production MySQL database name

5. Set up the Google Cloud Vision API credentials by providing the contents of the key file as the `GCP_CREDENTIALS` environment variable.

6. Deploy the Lambda function using the AWS CLI or AWS Management Console.

7. Make GET or POST requests to the Lambda function's endpoint, passing the required parameters.

## File Structure

The file structure of the project is as follows:

- `index.ts`: Contains the Lambda function code for handling GET and POST requests, integrating with MySQL and Google Cloud Vision API.

- `util.ts`: Contains utility functions for working with MySQL, Google Cloud Vision API, image processing, and environment variable management.

## Usage

### GET Request

Send a GET request to the Lambda function's endpoint with the following query parameters:

- `id`: (optional) The ID of the item to retrieve from the database.
- `sidoNm`: (optional) The name of the region (sido) to search for.
- `sigunNm`: (optional) The name of the city (sigun) to search for.
- `dongNm`: (optional) The name of the neighborhood (dong) to search for.

The Lambda function will retrieve the corresponding items from the database based on the provided parameters.

### POST Request

Send a POST request to the Lambda function's endpoint with the following JSON payload:

```json
{
  "receiptImage": "URL_OF_RECEIPT_IMAGE",
  "id": "ITEM_ID",
  "userId": "USER_ID",
  "rate": 4.5,
  "comment": "Review comment",
  "treatmentNm": "Treatment name"
}
```

The Lambda function will process the receipt image, perform text detection using Google Cloud Vision API, and store the review information in the MySQL database.

Please make sure to replace the placeholder values and customize the code as per your requirements.

Feel free to reach out if you have any further questions or need assistance.

