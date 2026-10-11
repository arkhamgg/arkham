import test from "node:test";
import assert from "node:assert/strict";
import { generateRoundRobinSchedule, calculateRoundRobinStandings, validateRoundRobinResults } from "../src/js/services/competitionRoundRobin.js";

const players = [{id:"a",name:"Alpha"},{id:"b",name:"Bravo"},{id:"c",name:"Charlie"},{id:"d",name:"Delta"}];

test("4 players, single round robin = 3 rounds and 6 fixtures", () => {
  const s = generateRoundRobinSchedule({phaseGroupId:"pool-a",participants:players});
  assert.equal(s.rounds.length, 3); assert.equal(s.matches.length, 6);
  assert.equal(new Set(s.matches.map(m=>m.roundRobin.fixtureKey)).size, 6);
});
test("double round robin doubles fixture count", () => {
  const s = generateRoundRobinSchedule({phaseGroupId:"pool-a",participants:players,rounds:2});
  assert.equal(s.rounds.length, 6); assert.equal(s.matches.length, 12);
});
test("odd pool has byes but no fake matches", () => {
  const s = generateRoundRobinSchedule({phaseGroupId:"pool-b",participants:players.slice(0,3)});
  assert.equal(s.matches.length, 3); assert.equal(s.rounds.length, 3);
});
test("standings only count completed matches and award points", () => {
  const matches = [
    {id:"m1",status:"COMPLETED",entryAId:"a",entryBId:"b",result:{scoreA:2,scoreB:0},winnerEntryId:"a"},
    {id:"m2",status:"COMPLETED",entryAId:"a",entryBId:"c",result:{scoreA:1,scoreB:2},winnerEntryId:"c"},
    {id:"m3",status:"PENDING",entryAId:"b",entryBId:"c"}
  ];
  const table = calculateRoundRobinStandings({participants:players.slice(0,3),matches,tiebreakers:["score_difference","wins"]});
  assert.equal(table.find(r=>r.entryId==="a").points,3);
  assert.equal(table.find(r=>r.entryId==="b").played,1);
});
test("qualification flags top N", () => {
  const t = calculateRoundRobinStandings({participants:players,matches:[],qualification:{qualifiers:2}});
  assert.deepEqual(t.map(r=>r.qualified),[true,true,false,false]);
});
test("duplicate participants are rejected", () => {
  assert.throws(()=>generateRoundRobinSchedule({phaseGroupId:"p",participants:[{id:"x"},{id:"x"}]}),/asignado más de una vez/);
});
test("match validation reports malformed matches", () => {
  const r = validateRoundRobinResults([{id:"m",entryAId:"a",entryBId:"a"},{id:"m",entryAId:"b"}]);
  assert.equal(r.valid,false); assert.ok(r.errors.length >= 3);
});
