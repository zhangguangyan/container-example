import {InMemoryProject} from "@atomist/automation-client";
import * as yaml from "js-yaml";
import * as assert from "power-assert";
import {DynamicContainerGoalDefinition, isContainerGoalDefinition, retrieveProjectContainerDetails} from "../../lib/containerGoal";

describe("inspectContainerGoalDefinition", () => {
    it ("should return true for valid conatinerGoalDefinition object", () => {
        const test: DynamicContainerGoalDefinition = {
            displayName: "foo",
            image: "foo",
            version: "foo",
            command: "foo",
            arguments: [],
        };
        assert.strictEqual(isContainerGoalDefinition(test), true);
    });
    it ("should return false for invalid conatinerGoalDefinition object", () => {
        // Missing display name
        const test: DynamicContainerGoalDefinition = {
            image: "foo",
            version: "foo",
            command: "foo",
            arguments: [],
        } as any;
        assert.strictEqual(isContainerGoalDefinition(test), false);

    });
});
describe("retrieveProjectContainerDetails", () => {
    it ("should load the contents of YAML", async () => {
        const p = InMemoryProject.of({path: "goals.yaml", content: yaml.safeDump(testData)});
        const result = await retrieveProjectContainerDetails((p as any));
        assert(result.length > 0);
        assert(result.every(isContainerGoalDefinition));
    });
    it ("should load the contents of YAML (yml)", async () => {
        const p = InMemoryProject.of({path: "goals.yml", content: yaml.safeDump(testData)});
        const result = await retrieveProjectContainerDetails((p as any));
        assert(result.length > 0, "No results!");
        assert(result.every(isContainerGoalDefinition));
    });
    it ("should load the contents of JSON", async () => {
        const p = InMemoryProject.of({path: "goals.json", content: JSON.stringify(testData)});
        const result = await retrieveProjectContainerDetails((p as any));
        assert(result.length > 0, "No results!");
        assert(result.every(isContainerGoalDefinition));

    });
    it ("should throw on malformed input", async () => {
        const newData = testData[0];
        delete newData.command;
        const p = InMemoryProject.of({path: "goals.json", content: JSON.stringify([newData])});
        try {
            await retrieveProjectContainerDetails((p as any));
        } catch (e) {
            assert.strictEqual(e.message, "Invalid Container Goal supplied.  Offender => {\"displayName\":\"Test Container Goal" +
                " 1\",\"image\":\"ubuntu\",\"version\":\"18.04\",\"arguments\":[\"+%s\"],\"preApproval\":true}");
        }
    });
    it ("should return empty on missing input", async () => {
        const p = InMemoryProject.of();
        const result = await retrieveProjectContainerDetails((p as any));
        assert.strictEqual(result.length, 0);
    });
});

const testData: DynamicContainerGoalDefinition[] = [
    {
        displayName: "Test Container Goal 1",
        image: "ubuntu",
        version: "18.04",
        command: "date",
        arguments: ["+%s"],
        preApproval: true,
    },
    {
        displayName: "Test Container Goal 2",
        image: "ubuntu",
        version: "18.04",
        command: "apt-get",
        arguments: ["list"],
        retry: false,
    },
];
