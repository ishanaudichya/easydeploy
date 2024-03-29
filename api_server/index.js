const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { generateSlug } = require("random-word-slugs");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const { Redis } = require("ioredis");
dotenv.config();

const app = express();

app.use(bodyParser.json({ limit: "30mb", extended: true }));
app.use(bodyParser.urlencoded({ limit: "30mb", extended: true }));
app.use(cors({ origin: "*" }));

const subscriber = new Redis(process.env.REDIS_URL);

const io = new Server({ cors: "*" });

io.on("connection", (socket) => {
  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", `Joined ${channel}`);
  });
});

io.listen(9002, () => console.log("Socket Server 9002"));

const ecsClient = new ECSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});

app.post("/", async (req, res) => {
  const git_url = req.body.git_url;
  const project_id = req.body.project_id ? req.body.project_id : generateSlug();
  const clusterName = "netlify-builder-cluster";
  const taskDefinition = "netlify-builder-task:1";
  const containerName = "netlify-builder-image";
  const variables = [
    { name: "GIT_REPOSITORY__URL", value: git_url },
    { name: "PROJECT_ID", value: project_id },
  ];
  const command = new RunTaskCommand({
    cluster: clusterName,
    taskDefinition: taskDefinition,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: "ENABLED",
        subnets: [
          process.env.SUBNET1,
          process.env.SUBNET2,
          process.env.SUBNET3,
        ],
        securityGroups: [process.env.SECURITY_GROUPS],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: containerName,
          environment: variables,
        },
      ],
    },
  });
  try {
    await ecsClient.send(command);
    console.log("ECS task Running Successfully");
    res.status(200).json({
      status: "queued",
      data: {
        message: "ECS Task started",
        projectid: project_id,
      },
    });
  } catch (e) {
    console.log("Error starting ECS task: ", e.message);
    res.status(500).json({ message: "Error starting ECS task" });
  }
});

async function initRedisSubscribe() {
  console.log("Subscribed to logs....");
  subscriber.psubscribe("logs:*");
  subscriber.on("pmessage", (pattern, channel, message) => {
    io.to(channel).emit("message", message);
  });
}

initRedisSubscribe();

app.listen(5000, () => {
  console.log("Server started on Port 5000");
});
