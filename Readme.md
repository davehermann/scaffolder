# Scaf-folder

*"Hmm, I need to update my basic scaffold so that I can easily use that new code feature"*

*"Let me just pull up my Yeoman configuration and create a new generator that handles it"*

*"Why is this so complicated that it's unfamiliar? Didn't I just do this **only two months** ago???*

*"Why am I managing every template manually?"*

*"Let me take a quick look at the documentation."*

*"How many different pages do I need to read to remember this?"*

## Why Scaf-folder?

I don't want to knock Yeoman.
It's been great!
It was a critical tool for a long time for quickly generating application stubs, but we're in an era where every framework has a one-line application generator, and no one has time to maintain complex configurations.
And those application generators only get you so far, so something has to give.

### Enter Scaf-folder

You need to follow a very basic application structure for the main composer in your application, but simple design is the key to ease-of-use.

## Getting Started

*The **current** version of **Scaf-folder** assumes it's installed globally (`npm install -g scaffolder`), and so are your composers.
A future version will be installable locally, and allow local composer-lookup.*

### Install Scaf-folder
```
npm install -g scaf-folder
```

### Create a Composer/Composer Group

***Composer groups** are more than one composer that work together and can call each other successively*

#### Basic structure
<pre>
- My Composer Folder
  |
  - composers
  | |
  | - main
  |   |
  |   composer.js
  |   |
  |   - templates
  |     |
  |     .eslintrc.js
  |     |
  |     .gitignore
  |     |
  |     package.json
  |
  package.json
</pre>

The composer named **My Composer Folder** contains a subdirectory named **composers**.
This structure (`./composers/main/composer.js`) **is required** to identify a composer.
Other related composers will also be in the `./composers/` subdirectory.

#### composer.js

A composer must inherit from the **Scaf-folder** *RootComposer* class, and export that inherited class as *Composer*.
The composer must pass **__dirname** into the *RootComposer* constructor.

*The first composer in a group that needs to write template files **must** set the installDestination property on configuration.
See below.*

This basic class can look as simple as follows, and will write *.eslintrc.js*, *.gitignore*, and *package.json* to a `New App` directory created below your command line current directory:

```javascript
import * as path from "path";
import { RootComposers } from "scaffolder";

class MainComposer extends RootComposers {
    constructor() {
        super(__dirname);
    }

    SetConfiguration({ answers, configuration }) {
        // Your composers will probably prompt the user for the name of the application, and use that as the install location
        configuration.installDestination = path.join(process.cwd(), "New App");
    }
}

export {
    MainComposer as Composer,
};
```

#### templates

All templates are written to the file system.
Templates support a replacement token system: Wrap your tokens in three dollar signs: `$$$mytoken$$$`.
Tokens automatically replace for answers, and configuration objects.
Tokens support a few manipulations.
```json
{
    "name": "$$$answers.main.appName$$$",
    "author": "$$$answers.main.author/default:John Smith<jsmith@example.com>$$$"
}

```

##### Replacement manipulations
