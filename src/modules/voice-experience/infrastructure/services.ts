import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { VoiceDraftService } from "../application/drafts";
import { voiceDraftRepository } from "./draft-repository";
import { VoiceInputService } from "../application/input";
import { fakeVoiceIntentAdapter } from "./fake-intent-adapter";

export function voiceDraftService() {
  const repository = () => voiceDraftRepository(database());
  return new VoiceDraftService(authorizationService(), {
    farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input),
  }, {
    create: (scope, review) => repository().create(scope, review),
    read: (scope, id) => repository().read(scope, id),
    outcome: (scope, id) => repository().outcome(scope, id),
    edit: (scope, id, input) => repository().edit(scope, id, input),
    confirm: (scope, id, input) => repository().confirm(scope, id, input),
  });
}

export function voiceInputService() {
  return new VoiceInputService(authorizationService(), {
    farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input),
  }, { text: new Map([["en", fakeVoiceIntentAdapter]]), speech: [] });
}
