const { OpenAI } = require("openai");
const axios = require('axios');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const onGoingThreads = {};

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const terminalStates = ["cancelled", "failed", "completed", "expired"];

const statusCheckLoop = async (openAiThreadId, runId) => {
    const run = await openai.beta.threads.runs.retrieve(
        openAiThreadId,
        runId
    );

    if (terminalStates.indexOf(run.status) < 0) {
        await sleep(1000);
        return statusCheckLoop(openAiThreadId, runId);
    }

    return run.status;
}

const createOrGetThread = async () => {
  if (onGoingThreads.id) {
    // If there is an ongoing thread, return its ID
    return onGoingThreads.id;
  }

  // If there is no ongoing thread, create a new one
  const thread = await openai.beta.threads.create();
  onGoingThreads.id = thread.id; // Store the thread ID
  console.log(`Created new thread with ID: ${onGoingThreads.id}`);
  return onGoingThreads.id;
};

const chatCompletion = async (prompt) => {
  const openAiThreadId = await createOrGetThread();

  await openai.beta.threads.messages.create(
    openAiThreadId,
    {
      role: "user",
      content: prompt
    }
  );

  const messages = await openai.beta.threads.messages.list(openAiThreadId);
  const lastUserMessage = messages.data.find(message => message.role === 'user');

  if (lastUserMessage && lastUserMessage.content[0].text.value.toLowerCase().includes('i need a human')) {
    const apiUrl = 'https://www.acceptrec.co.uk/api/botpress';
    const data = {
      // Adjust this data as per your requirements
      name: 'Name',
      tel: 'Tel',
      email: 'email',
      summary: 'summary',
    };

    try {
      const response = await axios.post(apiUrl, data, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(response.data);

      const run = await openai.beta.threads.runs.create(
        openAiThreadId,
        {
          assistant_id: process.env.OPENAI_ASSISTANT_ID
        }
      );
  
      await statusCheckLoop(openAiThreadId, run.id);
  
      const updatedMessages = await openai.beta.threads.messages.list(openAiThreadId);
      const content = updatedMessages.data[0].content[0].text.value;
  
      return content;

    } catch (error) {
      console.error('Error:', error);
    }
  } else {
    const run = await openai.beta.threads.runs.create(
      openAiThreadId,
      {
        assistant_id: process.env.OPENAI_ASSISTANT_ID
      }
    );

    await statusCheckLoop(openAiThreadId, run.id);

    const updatedMessages = await openai.beta.threads.messages.list(openAiThreadId);
    const content = updatedMessages.data[0].content[0].text.value;

    return content;
  }
};

module.exports = {
  chatCompletion
};
