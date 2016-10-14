## Synopsis

Amber is a simple node.js framework for making personal assistants.

## Motivation

Amber provides many abstractions to help developers think about their bots. I made Amber to provide a high level framework for working with personal assistants in a way more similar to working with graphs.

## Usage

Here are some of the main abstractions in Amber:

### Targets
A **target** is the action that the user wishes to perform with a query. Text is entered into a chatbot and a *target parser* (I have used, for example, Microsoft’s [LUIS](https://www.luis.ai).) categorizes the text into one of many targets. A target is a *thing* that your bot can *do*. 

### Requirements
Sometimes to *do* something, your bot requires information about the user or the outside world. A **requirement** is something that your bot can *have*, like a location or a name. When defining a target, you can put in a list of requirements that must be fulfilled before the target is reached. Also, requirements can have requirements themselves. For instance, a label may be needed to find out the ID of a resource.

### Filters
“What is the weather in LA” is clearly a `weather` target, but it also contains information about the `location`. Filters are defined with each requirement, and they take what we *think* might have enough information to fulfill a requirement and either fulfills is by transforming the information into the correct format, or tells the system that it still needs to ask the user about it.

## Example
Here is a look at the graph for a bot I made which lets members check out resources for a VR Club: **VR-Bot**.

![](http://keirp.com/projects/chatbotkit/graph.png)

As you can see, to get to the target `add_equipment`, you have to first fulfill the requirements of `type`, `owner`, `location`, and `label`.

Let’s say we want to add a new Oculus Rift. We type “I want to add a new rift.” First, this sentence is passed to Microsoft’s LUIS. It returns:

`{
  “query”: “I want to add a new rift.”,
  “intents”: [
    {
      “intent”: “add_equipment”
    }
  ],
  “entities”: [
    {
      “entity”: “rift”,
      “type”: “type”
    }
  ]
}`

The **target** is set to `add_equipment` and Amber will try to fulfill the `type` **requirement** with “rift”. For `type`, the filter essentially finds the highest scoring `type` from the server using a modified version of this [algorithm](http://www.catalysoft.com/articles/StrikeAMatch.htmlhttp://www.catalysoft.com/articles/StrikeAMatch.html) and fulfills the `type` requirement with an object containing the name of the type and its ID on the server.

Next, Amber will recursively attempt to fulfill every requirement for `add_equipment`. In this case, `add_equipment` is defined with the following requirements: `[‘type’, ‘owner’, ‘location’, ‘label’]`. `Type` is already fulfilled, so it will call `toGet` on `owner` to get the `owner`’s name and ID, and do the same for `location` and `label`. Once every requirement is fulfilled, `add_equipment`’s `onExecute` method is called, the user is prompted to confirm the accuracy of the information entered and they can add the new equipment.



## Installation

npm install amberchat

## API Reference

Documentation is provided in /docs

## License

MIT License

Copyright (c) 2016 Keiran Paster

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
