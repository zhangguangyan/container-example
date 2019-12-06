import {GitProject, guid, projectUtils, RetryOptions} from "@atomist/automation-client";
import {ExecuteGoalResult, goal, GoalInvocation, PlannedGoal, spawnLog} from "@atomist/sdm";
import {FulfillableGoalDetails} from "@atomist/sdm/lib/api/goal/GoalWithFulfillment";
import * as yaml from "js-yaml";

export interface DynamicContainerGoalDefinition {
    image: string;
    version: string;
    command: string;
    arguments: string[];
    displayName: string;
    approval?: boolean;
    preApproval?: boolean;
    retry?: boolean;
    descriptions?: FulfillableGoalDetails["descriptions"];
    retryCondition?: RetryOptions;
}

export const containerGoal = goal(
    {
        uniqueName: "dyn-container-goal",
        displayName: "Dynamic Container Goal",
    },
    async gi => {
        gi.progressLog.write(`New goal, details => ${JSON.stringify(gi.parameters)}`);
        return runDockerStuff(gi);
    },
    {
        plan: async pli => {
            // Load in-project config
            const newGoals: PlannedGoal[] = [];
            const details = await retrieveProjectContainerDetails(pli.project);
            for (const deets of details) {
                const params = {
                    image: deets.image,
                    version: deets.version,
                    command: deets.command,
                    args: deets.arguments,
                };

                newGoals.push({
                    details: {
                        displayName: deets.displayName,
                        approval: deets.approval,
                        preApproval: deets.preApproval,
                        descriptions: deets.descriptions,
                        retry: deets.retry,
                        retryCondition: deets.retryCondition,
                    },
                    parameters: params,
                });
            }

            return {
                containers: {
                    goals: newGoals,
                },
            };
        },
    },
);

export async function retrieveProjectContainerDetails(p: GitProject): Promise<DynamicContainerGoalDefinition[]> {
    const count = await projectUtils.countFiles(p, ["goals.json", "goals.y{,a}ml"]);
    const data: DynamicContainerGoalDefinition[] = [];

    if (count === 1) {
        // Load in-project stuff
        await projectUtils.doWithFiles(p, ["goals.json", "goals.y{,a}ml"], async f => {
            const rawData = yaml.safeLoad(await f.getContent()) as DynamicContainerGoalDefinition[];
            for (const r of rawData) {
                if (isContainerGoalDefinition(r)) {
                    data.push(r);
                } else {
                    throw new Error(`Invalid Container Goal supplied.  Offender => ${JSON.stringify(r)}`);
                }
            }
        });

    } else if (count === 2) {
        throw new Error("You may not supply both goals.json and goals.yaml, use one or the other");
    }

    return data;
}

export function isContainerGoalDefinition(r: DynamicContainerGoalDefinition): r is DynamicContainerGoalDefinition {
    return r.hasOwnProperty("image") &&
    r.hasOwnProperty("version") &&
    r.hasOwnProperty("command") &&
    r.hasOwnProperty("arguments") &&
    r.hasOwnProperty("displayName");
}

// tslint:disable-next-line:cyclomatic-complexity
export async function runDockerStuff(gi: GoalInvocation): Promise<ExecuteGoalResult> {
    const spawnOpts = {
        log: gi.progressLog,
    };
    const containerName = `${gi.id.repo}-${gi.parameters?.image}-${guid()}`;
    const dockerArgs = [
        "run",
        "--tty",
        "--rm",
        `--name=${containerName}`,
        `${gi.parameters?.image}:${gi.parameters?.version}`,
        `${gi.parameters?.command}`,
        ...gi.parameters?.args,
    ];
    const result = await spawnLog("docker", dockerArgs, spawnOpts);
    let data: ExecuteGoalResult = {};
    if (result.code) {
        gi.progressLog.write(`Docker container '${containerName}' failed` + ((result.error) ? `: ${result.error.message}` : ""));
        data = {
            code: 1,
            message: result.error?.message,
        };
    } else {
        data = {
            code: 0,
        };
    }

    return data;
}
