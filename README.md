# Overview

As a software engineer and plant collector, I built Rooted Upright to solve a real problem 
in my own life. I have over twenty named plants, each with a story, a care schedule, and 
a personality. I wanted a place to catalog them properly, log their care history, and keep 
their lore alive. This project gave me the opportunity to work hands-on with AWS serverless 
architecture for the first time, building a full cloud-backed application from scratch.

Rooted Upright is a houseplant care and catalog app built on a fully serverless AWS stack. 
Users can add plants with species, cultivar, lore, care instructions, and watch-for notes. 
Each plant has a care log timeline where watering, fertilizing, repotting, pruning, and 
drama events are recorded and displayed. The app uses AWS Cognito for user authentication, 
DynamoDB for cloud storage across two related tables, Lambda for backend logic, and API 
Gateway to expose REST endpoints to a React frontend.

To use the app: sign in with your credentials, browse your specimen catalog, add new plants 
using the Add_Specimen form, click Edit to update any plant, click Log_Care to record a care 
event, and click View_Log to see the care timeline for any plant.

[Software Demo Video](https://youtu.be/jIkwwpJBeXM)

# Cloud Database

Rooted Upright uses Amazon DynamoDB, a fully managed NoSQL key-value and document database 
hosted on AWS. DynamoDB requires no server management, scales automatically, and charges 
only for what is used — making it ideal for this project.

Two tables were created:

**Plants** — stores the plant catalog. Each item contains a unique `plantId` (UUID partition 
key), `name`, `species`, `cultivar`, `lore`, `careInstructions`, `watchFor`, and `dateAdded`.

**CareLogs** — stores care history per plant. Each item contains a unique `logId` (UUID 
partition key), `plantId` (sort key, links to the Plants table), `careType`, `notes`, and 
`dateLogged`. A Global Secondary Index on `plantId` enables querying all care logs for a 
specific plant.

# Development Environment

- **IDE:** VS Code
- **Terminal:** PowerShell
- **Version Control:** Git + GitHub
- **Frontend:** React (Vite), JavaScript, Axios, CSS
- **Backend:** AWS Lambda (Node.js 22), AWS API Gateway (HTTP API), AWS DynamoDB
- **Authentication:** AWS Cognito with react-oidc-context
- **AWS SDK:** @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb

# Useful Websites

- [AWS DynamoDB Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
- [AWS API Gateway Documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html)
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html)
- [react-oidc-context GitHub](https://github.com/authts/react-oidc-context)
- [DynamoDB Global Secondary Indexes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html)
- [Vite Documentation](https://vitejs.dev/guide/)

# Future Work

- Add watering reminders using AWS EventBridge scheduled rules
- Implement S3 photo uploads so each plant card displays a photo
- Build a room/location filter to browse plants by where they live in the home
- Add a printable care registry card per plant
- Migrate to React Native for Module 4 mobile app using the same API backend
- Explore Docker containerization for local development environment
- Add community features so collectors can share plant lore and care tips