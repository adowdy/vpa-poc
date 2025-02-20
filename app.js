// app-email.js
const AWS = require('aws-sdk');

// Configure AWS SDK (replace with your region)
AWS.config.update({region: 'us-east-2'}); // e.g., 'us-west-2'

// Create SNS and SQS service objects
const sns = new AWS.SNS();
const sqs = new AWS.SQS();

// Your SQS Queue URL (replace with your actual SQS Queue URL for receiving emails)
const sqsQueueUrl = 'https://sqs.us-east-2.amazonaws.com/664418981402/inbound-sms-queue'; // e.g., 'https://sqs.us-west-2.amazonaws.com/your-account-id/inbound-email-queue'

// Function to simulate receiving an email (for testing - in real use, SES would put emails in SQS)
async function simulateReceiveEmail(senderEmail, emailBody) {
    const params = {
        QueueUrl: sqsQueueUrl,
        MessageBody: JSON.stringify({
            senderEmail: senderEmail,
            emailBody: emailBody
        })
    };

    try {
        const sendResult = await sqs.sendMessage(params).promise();
        console.log('Simulated email sent to SQS. MessageId:', sendResult.MessageId);
    } catch (err) {
        console.error('Error simulating email:', err);
    }
}


async function receiveEmailFromSQS() {
    const params = {
        QueueUrl: sqsQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20
    };

    try {
        const data = await sqs.receiveMessage(params).promise();

        if (data.Messages) {
            for (const message of data.Messages) {
                const emailData = JSON.parse(message.Body);
                const senderEmailAddress = emailData.senderEmail;
                const receivedEmailContent = emailData.emailBody;

                console.log('Received Email from:', senderEmailAddress);
                console.log('Email Content:', receivedEmailContent);

                // Send Email Reply
                await sendEmailReply(senderEmailAddress, 'Confirmed, got your email message!');

                // Delete message from queue
                await sqs.deleteMessage({
                    QueueUrl: sqsQueueUrl,
                    ReceiptHandle: message.ReceiptHandle
                }).promise();
            }
        } else {
            console.log('No messages in queue.');
        }
    } catch (err) {
        console.error('Error receiving messages from SQS:', err);
    }
}

async function sendEmailReply(recipientEmail, messageBody) {
    const params = {
        Message: messageBody,
        Subject: 'Re: Your Email Confirmation',
        TopicArn: 'arn:aws:sns:us-east-2:664418981402:outgoing-customer-email' // Replace with your SNS Topic ARN for email sending
        // OR, to send directly to email address (simpler for testing, but less scalable for many recipients in real use):
        //  TargetArn: `arn:aws:sns:your-aws-region:your-aws-account-id:endpoint/EMAIL/MyApplication/some-unique-id`, // Example - you'd need to create an EMAIL endpoint subscription in SNS first if using TargetArn this way, or just use email address directly as below for simpler sending
        //  Endpoint: recipientEmail, // Send directly to email address - simpler for testing
        //  Protocol: 'email'

         // Simpler approach for direct email sending (no topic needed for just replies, but less scalable for broader notifications)
        //  Message: messageBody,
        //  Subject: 'Re: Your Email Confirmation',
        //  TargetArn: `arn:aws:sns:your-aws-region:664418981402:endpoint/EMAIL/${recipientEmail.replace(/[@.]/g, '-')}/some-unique-id` , // Construct a TargetArn -  **Important**: replace '/' and '.' in email with '-' to make it ARN compatible.  This is just an example, ARN format needs to be valid.  Direct email sending might be simpler for testing but less scalable for mass notifications compared to using topics.
        //  Endpoint: recipientEmail,
        //  Protocol: 'email'


         // **Even Simpler Direct Email Sending (using PhoneNumber parameter - actually works for email too!):**
        // Message: messageBody,
        // Subject: 'Re: Your Email Confirmation',
        // PhoneNumber: recipientEmail //  PhoneNumber parameter in SNS can actually be used for email addresses too for simple sending!  This is the easiest for testing.

    };


    try {
        const publishResponse = await sns.publish(params).promise();
        console.log('Email Reply sent to:', recipientEmail, 'MessageId:', publishResponse.MessageId);
    } catch (err) {
        console.error('Error sending email reply:', err);
    }
}


async function main() {
    console.log('Simulating sending initial email in 5 seconds...');
    setTimeout(async () => {
        await simulateReceiveEmail('dowdy.aaron@gmail.com', 'Hello, this is a test response email.'); // Simulate initial email coming in
    }, 5000); // Simulate initial email after 5 seconds

    console.log('Listening for emails from SQS...');
    while(true) {
        await receiveEmailFromSQS();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every 1 second
    }
}

main();