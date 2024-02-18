const express = require("express");
const bodyParser = require("body-parser")
const cors = require("cors")
const {ECSClient ,RunTaskCommand} = require("@aws-sdk/client-ecs")
const {generateSlug} = require("random-word-slugs")
const dotenv = require("dotenv");

dotenv.config();
 
const app = express();

app.use(bodyParser.json({limit:'30mb', extended:true}))
app.use(bodyParser.urlencoded({limit:'30mb', extended:true}))
app.use(cors({origin:'*'}));

const ecsClient = new ECSClient({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY
    }
})

app.get("/",()=> {
    console.log(process.env.ACCESS_KEY_ID)
    console.log(process.env.SECRET_ACCESS_KEY)
})

app.post("/", async (req, res) => {
    const git_url = req.body.git_url;
    const project_id = req.body.project_id ? req.body.project_id : generateSlug();
    const clusterName = 'netlify-builder-cluster';
    const taskDefinition = 'netlify-builder-task:1';
    const containerName = 'netlify-builder-image';
    const variables = [
        { name: "GIT_REPOSITORY__URL", "value": git_url},
        { name: "PROJECT_ID", value: project_id}
    ]
    const command = new RunTaskCommand({
        cluster:clusterName,
        taskDefinition: taskDefinition,
        launchType:'FARGATE',
        count:1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: [process.env.SUBNET1, process.env.SUBNET2, process.env.SUBNET3],
                securityGroups: [process.env.SECURITY_GROUPS]
            }
        },
        overrides: {
            containerOverrides:[
                {
                name: containerName, 
                environment: variables
                }
            ]
        }
    });
    try {
        await ecsClient.send(command);
        console.log("ECS task Running Successfully")
        res.status(200).json({message:"ECS Task started", url:`http://${project_id}.localhost:8000`})
    } catch (e) {
        console.log("Error starting ECS task: ", e.message)
        res.status(500).json({message:"Error starting ECS task"})
    }

})

app.listen(5000, ()=>{
    console.log("Server started on Port 5000")
})