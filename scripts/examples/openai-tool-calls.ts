/**
 * Demonstrates OpenAI tool calls with gpt-5 using the raw openai SDK.
 *
 * Asks the model to compute a precise math expression — something it
 * fundamentally cannot do reliably without calling the calculator tool.
 * This guarantees a tool call on every run.
 *
 * Usage: bun run scripts/examples/openai-tool-calls.ts
 */
import OpenAI from "openai";

const client = new OpenAI(); // uses OPENAI_API_KEY from env

// Define a calculator tool
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "calculate",
      description:
        "Evaluate a mathematical expression and return the exact numeric result. You MUST use this tool for any arithmetic — do not attempt to compute in your head.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description:
              'The math expression to evaluate, e.g. "(1337 * 7919) + 42"',
          },
        },
        required: ["expression"],
      },
    },
  },
];

// A prompt that forces tool use — precise arithmetic the model can't fake
const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  {
    role: "system",
    content:
      "You are a precise math assistant. Always use the calculate tool for arithmetic. Never guess.",
  },
  {
    role: "user",
    content:
      "What is (7823 * 4519) + (1337 ^ 3) - 98765? Show the intermediate steps.",
  },
];

async function run() {
  const conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [...messages];
  let round = 0;

  // Loop until the model stops calling tools
  while (true) {
    round++;
    console.log(`--- Round ${round}: sending request to gpt-5 ---\n`);

    const response = await client.chat.completions.create({
      model: "gpt-5",
      messages: conversation,
      tools,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    console.log("Finish reason:", choice.finish_reason);
    console.log("Tool calls:", assistantMessage.tool_calls?.length ?? 0, "\n");

    // Append assistant message to conversation history
    conversation.push(assistantMessage);

    // Done — model gave a final text response
    if (choice.finish_reason === "stop") {
      console.log("Final answer:\n");
      console.log(assistantMessage.content);
      break;
    }

    if (!assistantMessage.tool_calls?.length) {
      console.log("Unexpected state — no tool calls but finish_reason:", choice.finish_reason);
      console.log(JSON.stringify(choice, null, 2));
      break;
    }

    // Execute each tool call and append results to conversation
    for (const toolCall of assistantMessage.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      console.log(`Tool call: ${toolCall.function.name}("${args.expression}")`);

      let result: string;
      try {
        const fn = new Function(`return (${args.expression})`);
        result = String(fn());
      } catch (e: any) {
        result = `Error: ${e.message}`;
      }

      console.log(`  => ${result}\n`);

      conversation.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }
}

run().catch(console.error);
