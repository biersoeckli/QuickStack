import { components as agentBaseComponents } from "./agents.x-k8s.io-v1beta1.openapi";
import { components as agentExtendedConponents } from "./extensions.agents.x-k8s.io-v1beta1.openapi";

export type Sandbox =
    agentBaseComponents['schemas']['io.x-k8s.agents.v1beta1.Sandbox'];

export type SandboxList =
    agentBaseComponents['schemas']['io.x-k8s.agents.v1beta1.SandboxList'];

export type SandboxTemplate =
    agentExtendedConponents['schemas']['io.x-k8s.agents.extensions.v1beta1.SandboxTemplate'];

export type SandboxTemplateList =
    agentExtendedConponents['schemas']['io.x-k8s.agents.extensions.v1beta1.SandboxTemplateList'];

export type SandboxClaim =
    agentExtendedConponents['schemas']['io.x-k8s.agents.extensions.v1beta1.SandboxClaim'];

export type SandboxClaimList =
    agentExtendedConponents['schemas']['io.x-k8s.agents.extensions.v1beta1.SandboxClaimList'];

export type SandboxWarmPool =
    agentExtendedConponents['schemas']['io.x-k8s.agents.extensions.v1beta1.SandboxWarmPool'];

export type SandboxWarmPoolList =
    agentExtendedConponents['schemas']['io.x-k8s.agents.extensions.v1beta1.SandboxWarmPoolList'];
