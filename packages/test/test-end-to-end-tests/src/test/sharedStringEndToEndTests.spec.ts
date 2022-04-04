/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { Container } from "@fluidframework/container-loader";
import { requestFluidObject } from "@fluidframework/runtime-utils";
import { SharedString } from "@fluidframework/sequence";
import {
    ITestObjectProvider,
    ITestContainerConfig,
    DataObjectFactoryType,
    ChannelFactoryRegistry,
    ITestFluidObject,
} from "@fluidframework/test-utils";
import { describeFullCompat, describeNoCompat } from "@fluidframework/test-version-utils";
import { ContainerRuntime, OrderSequentiallyFailureMode } from "@fluidframework/container-runtime";

const stringId = "sharedStringKey";
const registry: ChannelFactoryRegistry = [[stringId, SharedString.getFactory()]];
const testContainerConfig: ITestContainerConfig = {
    fluidDataObjectType: DataObjectFactoryType.Test,
    registry,
};

describeFullCompat("SharedString", (getTestObjectProvider) => {
    let provider: ITestObjectProvider;
    beforeEach(() => {
        provider = getTestObjectProvider();
    });

    let sharedString1: SharedString;
    let sharedString2: SharedString;

    beforeEach(async () => {
        const container1 = await provider.makeTestContainer(testContainerConfig) as Container;
        const dataObject1 = await requestFluidObject<ITestFluidObject>(container1, "default");
        sharedString1 = await dataObject1.getSharedObject<SharedString>(stringId);

        const container2 = await provider.loadTestContainer(testContainerConfig) as Container;
        const dataObject2 = await requestFluidObject<ITestFluidObject>(container2, "default");
        sharedString2 = await dataObject2.getSharedObject<SharedString>(stringId);
    });

    it("can sync SharedString across multiple containers", async () => {
        const text = "syncSharedString";
        sharedString1.insertText(0, text);
        assert.equal(sharedString1.getText(), text, "The retrieved text should match the inserted text.");

        // Wait for the ops to to be submitted and processed across the containers.
        await provider.ensureSynchronized();

        assert.equal(sharedString2.getText(), text, "The inserted text should have synced across the containers");
    });

    it("can sync SharedString to a newly loaded container", async () => {
        const text = "syncToNewContainer";
        sharedString1.insertText(0, text);
        assert.equal(sharedString1.getText(), text, "The retrieved text should match the inserted text.");

        // Wait for the ops to to be submitted and processed across the containers.
        await provider.ensureSynchronized();

        // Create a initialize a new container with the same id.
        const newContainer = await provider.loadTestContainer(testContainerConfig) as Container;
        const newComponent = await requestFluidObject<ITestFluidObject>(newContainer, "default");
        const newSharedString = await newComponent.getSharedObject<SharedString>(stringId);
        assert.equal(
            newSharedString.getText(), text, "The new container should receive the inserted text on creation");
    });
});

describeNoCompat("SharedString orderSequentially", (getTestObjectProvider) => {
    let provider: ITestObjectProvider;
    beforeEach(() => {
        provider = getTestObjectProvider();
    });

    let container: Container;
    let dataObject: ITestFluidObject;
    let sharedString: SharedString;
    let containerRuntime: ContainerRuntime;

    beforeEach(async () => {
        container = await provider.makeTestContainer(testContainerConfig) as Container;
        dataObject = await requestFluidObject<ITestFluidObject>(container, "default");
        sharedString = await dataObject.getSharedObject<SharedString>(stringId);
        containerRuntime = dataObject.context.containerRuntime as ContainerRuntime;
    });

    it("Does not rollback when callback successful", () => {
        const text = "insertion";
        containerRuntime.orderSequentially(() => {
            sharedString.insertText(0, text);
        }, OrderSequentiallyFailureMode.Rollback);

        assert.equal(sharedString.getText(), text, "The retrieved text should match the inserted text.");
        assert.equal(containerRuntime.disposed, false);
    });

    it("Segment removed when callback fails", () => {
        const text = "insertion";
        const errorMessage = "callback failure";
        let error: Error | undefined;
        try {
            containerRuntime.orderSequentially(() => {
                sharedString.insertText(0, text);
                throw new Error(errorMessage);
            }, OrderSequentiallyFailureMode.Rollback);
        } catch(err) {
            error = err as Error;
        }

        assert.notEqual(error, undefined, "No error");
        assert.equal((error as Error).message, errorMessage, "Unexpected error message");
        assert.equal(sharedString.getText(), "", "The retrieved text should be empty.");
        assert.equal(containerRuntime.disposed, false);
    });

    it("Segment removed when callback fails with multiple segments", () => {
        const text1 = "insertion";
        const text2 = " here";
        const text3 = "The ";
        sharedString.insertText(0, text1);
        const errorMessage = "callback failure";
        let error: Error | undefined;
        try {
            containerRuntime.orderSequentially(() => {
                sharedString.insertText(text1.length, text2);
                sharedString.insertText(0, text3);
                throw new Error(errorMessage);
            }, OrderSequentiallyFailureMode.Rollback);
        } catch(err) {
            error = err as Error;
        }

        assert.notEqual(error, undefined, "No error");
        assert.equal((error as Error).message, errorMessage, "Unexpected error message");
        assert.equal(sharedString.getText(), text1, "The retrieved text should match before orderSequentially.");
        assert.equal(containerRuntime.disposed, false);
    });
});
