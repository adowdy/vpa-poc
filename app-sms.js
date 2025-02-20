// app.js
const AWS = require('aws-sdk');

// Configure AWS SDK (replace with your region)
AWS.config.update({region: 'us-east-2'}); // e.g., 'us-west-2'

// Create SNS and SQS service objects
const sns = new AWS.SNS();
const sqs = new AWS.SQS();

// Your SNS Topic ARN (replace with your actual Topic ARN for sending SMS)
const snsTopicArn = 'arn:aws:sns:us-east-2:664418981402:incoming-customer-sms';

// Your SQS Queue URL (replace with your actual SQS Queue URL for receiving SMS)
const sqsQueueUrl = 'https://sqs.us-east-2.amazonaws.com/664418981402/inbound-sms-queue'; // e.g., 'https://sqs.us-west-2.amazonaws.com/your-account-id/inbound-sms-queue'

async function receiveSMS() {
    const params = {
        QueueUrl: sqsQueueUrl,
        MaxNumberOfMessages: 10, // Adjust as needed
        WaitTimeSeconds: 20      // Long polling to reduce empty responses
    };

    try {
        const data = await sqs.receiveMessage(params).promise();

        if (data.Messages) {
            for (const message of data.Messages) {
                const smsContent = JSON.parse(message.Body).Message; // Assuming SNS JSON format for SQS
                const senderPhoneNumber = JSON.parse(message.Body).originationNumber;

                console.log('Received SMS from:', senderPhoneNumber);
                console.log('Message Content:', smsContent);

                // Send Reply
                await sendSMSReply(senderPhoneNumber, 'Confirmed, got your message!');

                // Delete message from queue to prevent reprocessing
                await sqs.deleteMessage({
                    QueueUrl: sqsQueueUrl,
                    ReceiptHandle: message.ReceiptHandle
                }).promise();
            }
        } else {
            console.log('No messages in queue.');
        }
    } catch (err) {
        console.error('Error receiving messages:', err);
    }
}

async function sendSMSReply(phoneNumber, message) {
    const params = {
        Message: message,
        PhoneNumber: phoneNumber
    };

    try {
        const publishResponse = await sns.publish(params).promise();
        console.log('SMS Reply sent to:', phoneNumber, 'MessageId:', publishResponse.MessageId);
    } catch (err) {
        console.error('Error sending SMS reply:', err);
    }
}

async function main() {
    console.log('Listening for inbound SMS messages...');
    while(true) {
        await receiveSMS();
        // Optional: Add a small delay to control polling frequency
        await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every 1 second
    }
}

main();