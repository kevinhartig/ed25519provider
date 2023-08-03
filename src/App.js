import React, { useState } from "react";
import { Ed25519Provider } from "key-did-provider-ed25519";
import KeyResolver from "key-did-resolver";
import { DID } from "dids";
import seedrandom from "seedrandom";
import { CeramicClient } from "@ceramicnetwork/http-client";
import { ComposeClient } from "@composedb/client";
import { definition } from "./__generated__/definition.js";

const ceramic = new CeramicClient("http://localhost:7007");
const composeClient = new ComposeClient({
    ceramic: "http://localhost:7007",
    // cast our definition as a RuntimeCompositeDefinition
    definition,
});

const App = () => {
    const [randomD, setRandomDid] = useState("");
    const [otherD, setOtherDid] = useState("");
    const [staticD, setStaticDid] = useState("");
    const [comment, setComment] = useState("");
    const [decrypted, setDecrypted] = useState("");

    const createRandomDID = async () => {
        if (!randomD) {
            console.log(randomD);
            const seed = new Uint8Array(32);
            crypto.getRandomValues(seed);
            const randomDid = new DID({
                provider: new Ed25519Provider(seed),
                resolver: KeyResolver.getResolver(),
            });
            await randomDid.authenticate();
            setRandomDid(randomDid.id);
        } else {
            alert("Already set");
        }
    };

    const createStaticDID = async () => {
        console.log(staticD);
        const uniqueKey = "0x7a8b9cde";
        const rng = seedrandom(uniqueKey);
        const seed = new Uint8Array(32);
        for (let i = 0; i < 32; i += 1) {
            seed[i] = Math.floor(rng() * 256);
        }
        const staticDid = new DID({
            provider: new Ed25519Provider(seed),
            resolver: KeyResolver.getResolver(),
        });
        await staticDid.authenticate();
        //authenticate on ceramic instance
        composeClient.setDID(staticDid);
        ceramic.did = staticDid;

        setStaticDid(staticDid.id);
        return staticDid;
    };

    const createOtherDID = async () => {
        const uniqueKey = "0x5p2z3def";
        const rng = seedrandom(uniqueKey);
        const seed = new Uint8Array(32);
        for (let i = 0; i < 32; i += 1) {
            seed[i] = Math.floor(rng() * 256);
        }
        const otherDid = new DID({
            provider: new Ed25519Provider(seed),
            resolver: KeyResolver.getResolver(),
        });
        await otherDid.authenticate();

        setOtherDid(otherDid.id);
        return otherDid;
    };

    const create = async () => {
        const staticDid = await createStaticDID();
        const cleartext = "this is a secret message";
        const jwe = await staticDid.createDagJWE(cleartext, [otherD]);
        //stringify your JWE object and replace escape characters
        const stringified = JSON.stringify(jwe).replace(/"/g, "`");
        if (staticD !== undefined) {
            const update = await composeClient.executeQuery(`
          mutation{
            createPost(
            input: {
                content: {
                text: "${stringified}"
                }
            }
            ) {
            document {
              id
              text
              author{
                id
                }
            }
            }
            }
          `);
            console.log('In create update value from query = ' + update);
            const item = update.data?.createPost?.document?.text;
            setComment(item)
        }
    };

    const decrypt = async () => {

        const query = await composeClient.executeQuery(`
      query{
        postIndex(last:1){
          edges{
            node{
              text
            }
          }
        }
      }
      `);
        console.log('In decrypt update value from query = ' + query)
        const arr = query.data?.postIndex?.edges;

        //Reverse-replacement of backticks for double-quotes prior to parsing
        const string = arr[0].node.text.replace(/`/g, '"');

        const other = await createOtherDID();
        console.log(other)
        await other.authenticate();

        const plaintext = await other.decryptDagJWE(JSON.parse(string));
        console.log(plaintext)
        setDecrypted(plaintext)
    };

    return (
        <div>
            <h1>Create DID</h1>
            <button onClick={createRandomDID}>Random DID</button>
            <p>DID: {randomD}</p>
            <br />
            <br />
            <br />
            <h2>1. Create Static DID</h2>
            <button onClick={createStaticDID}>Static DID</button>
            <p>DID: {staticD}</p>
            <br />
            <h2>2. Create Other DID</h2>
            <p>DID: {otherD}</p>
            <button onClick={createOtherDID}>Other DID</button>
            <br />
            <br />
            {otherD &&<h2>3. Create a Comment</h2>}
            {otherD &&<button onClick={create}>Create Comment</button>}
            {otherD && <p>Encrypted Comment: {comment}</p>}
            <br />
            <br />
            {otherD && <h2>4. Decrypt as Other DID</h2>}
            {otherD && <button onClick={decrypt}>Decrypt as Other DID</button>}
            {otherD && <p>Decrypted Comment: <br/> <br/> {decrypted}</p>}
        </div>
    );
};

export default App;