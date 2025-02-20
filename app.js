// app-email.js
const AWS = require('aws-sdk');
//const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

// Configure AWS SDK (replace with your region)
AWS.config.update({region: 'us-east-2'}); // e.g., 'us-west-2'

// Create SNS and SQS service objects
const sns = new AWS.SNS();
const sqs = new AWS.SQS();
const ses = new AWS.SES();

const params = {
  Source: "sender@example.com", // This must be a verified email in SES
  Destination: {
    ToAddresses: ["recipient@example.com"],
  },
  Message: {
    Subject: {
      Data: "Test Email via AWS SES with Default Credentials",
    },
    Body: {
      Text: {
        Data: "This email was sent using AWS SES, relying on the default credential provider chain!",
      },
    },
  },
};

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
                await sendEmailReply(senderEmailAddress, 'Confirmed, got your email message!', 'confirmed, message body');

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

async function sendEmailReply(toEmail, subject, body) {
    const params = {
        Source: "dowdy.aaron@gmail.com", // This must be a verified email in SES
        Destination: {
          ToAddresses: [toEmail],
        },
        Message: {
          Subject: {
            Data: "Got your request",
          },
          Body: {
            Text: {
              Data: "I got your message and am working on it!",
            },
          },
        },
      };
    
      try {
        // Use the promise interface of the sendEmail method
        const data = await ses.sendEmail(params).promise();
        console.log("Email sent successfully:", data);
      } catch (error) {
        console.error("Error sending email:", error);
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