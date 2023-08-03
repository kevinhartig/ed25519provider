import { readFileSync } from 'fs';
import { CeramicClient } from '@ceramicnetwork/http-client'
import {
    createComposite,
    readEncodedComposite,
    writeEncodedComposite,
    writeEncodedCompositeRuntime,
} from "@composedb/devtools-node";
import { Composite } from "@composedb/devtools";
import { DID } from 'dids';
import { Ed25519Provider } from "key-did-provider-ed25519";
import { getResolver } from "key-did-resolver";
import { fromString } from "uint8arrays/from-string";
import seedrandom from "seedrandom";

const ceramic = new CeramicClient("http://localhost:7007");

/**
 * @param {Ora} spinner - to provide progress status.
 * @return {Promise<void>} - return void when composite finishes deploying.
 */
export const writeComposite = async (spinner) => {
    await authenticate()
    spinner.info("writing composite to Ceramic")

    const postComposite = await createComposite(
        ceramic,
        "./composites/post.graphql"
    );

    const commentSchema = readFileSync("./composites/comment.graphql", {
        encoding: "utf-8",
    }).replace("$POST_ID", postComposite.modelIDs[0])

    const commentComposite = await Composite.create({
        ceramic,
        schema: commentSchema,
    });

    const postConnectSchema = readFileSync("./composites/postconnect.graphql", {
        encoding: "utf-8",
    }).replace("$COMMENT_ID", commentComposite.modelIDs[1])
        .replace("$POST_ID", postComposite.modelIDs[0])

    const postConnectComposite = await Composite.create({
        ceramic,
        schema: postConnectSchema,
    });

    const composite = Composite.from([
        postComposite,
        commentComposite,
        postConnectComposite
    ]);
    await writeEncodedComposite(composite, "./src/__generated__/definition.json");
    spinner.info('creating composite for runtime usage')
    await writeEncodedCompositeRuntime(
        ceramic,
        "./src/__generated__/definition.json",
        "./src/__generated__/definition.js"
    );
    spinner.info('deploying composite')
    const deployComposite = await readEncodedComposite(ceramic, './src/__generated__/definition.json')

    await deployComposite.startIndexingOn(ceramic)
    spinner.succeed("composite deployed & ready for use");
}

/**
 * Authenticating DID for publishing composite
 * @return {Promise<void>} - return void when DID is authenticated.
 */
const authenticate = async () => {
    const privateKey = fromString(
        readFileSync("account/admin-key", { encoding: "utf-8" }).trim(),
        "base16"
    )

    const did = new DID({
        resolver: getResolver(),
        provider: new Ed25519Provider(privateKey)
    })
    await did.authenticate()
    ceramic.did = did
}