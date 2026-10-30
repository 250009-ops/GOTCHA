import * as assert from 'node:assert/strict';
import {
  isDialogueLine,
  restoreDialogueLayout,
  splitDialogueAwareUnits,
  splitSmashedDialogueTurns,
} from './dialogue-layout';

assert.equal(isDialogueLine('‘I don’t care if he was your friend or not,’ said the policeman.'), true);
assert.equal(isDialogueLine('LENNY: Who is it?'), true);
assert.equal(isDialogueLine('A Visitor'), false);

const smashed =
  '‘Hello?’ ‘Who is it?’ ‘It’s me, Lenny.’ I walked to the door with enough extra story words here.';
const restored = restoreDialogueLayout(smashed);
assert.match(restored, /‘Hello\?’\n‘Who is it\?’\n‘It’s me, Lenny\.’/);
assert.match(restored, /I walked to the door/);

const sameSpeaker = restoreDialogueLayout('‘Hello,’ I said, ‘who is it?’');
assert.equal(sameSpeaker.includes('\n'), false, sameSpeaker);

const saidThen = restoreDialogueLayout('‘I don’t care,’ said the policeman. ‘Tell me why you killed him.’');
assert.match(saidThen, /policeman\.\n‘Tell me why/);

assert.deepEqual(splitSmashedDialogueTurns('‘Hello?’ ‘Who is it?’'), ['‘Hello?’', '‘Who is it?’']);

const units = splitDialogueAwareUnits(
  `I walked to the door.\n‘Hello?’\n‘Who is it?’\n‘It’s me, Lenny.’\nThe door opened slowly.`,
);
assert.equal(units[0]?.kind, 'prose');
assert.equal(units[1]?.kind, 'dialogue');
assert.equal(units[1]?.text.split('\n').length, 3);
assert.equal(units[2]?.kind, 'prose');

console.log('dialogue-layout tests passed');
