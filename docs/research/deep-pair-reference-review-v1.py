#!/usr/bin/env python3
"""Iterative, stdlib-only exact review of the depth-256/512 research population."""
import hashlib
import json
from fractions import Fraction
from pathlib import Path
import sys


SOURCE = Path(sys.argv[1]) if len(sys.argv) == 2 else Path("apps/api/data/research/deep-pair-population-v1.json")
POLICY = "absolute-sum-deep-pair-v1"


def text(value): return str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"

def shape(root):
    count = depth = 0; stack = [(root, 0)]
    while stack:
        node, level = stack.pop(); count += 1; depth = max(depth, level)
        op = node["op"]
        if op in ("variable", "constant"): continue
        if op in ("negate", "abs", "square"): stack.append((node["arg"], level + 1))
        else: stack.extend(((node["left"], level + 1), (node["right"], level + 1)))
    return depth, count

def evaluate(root, x):
    stack = [(root, False)]; values = []
    while stack:
        node, ready = stack.pop(); op = node["op"]
        if not ready:
            if op == "variable": values.append(x); continue
            if op == "constant": values.append(Fraction(node["value"])); continue
            stack.append((node, True))
            if op in ("negate", "abs"): stack.append((node["arg"], False))
            elif op in ("add", "multiply"): stack.extend(((node["right"], False), (node["left"], False)))
            else: raise ValueError(op)
            continue
        if op == "negate": values.append(-values.pop())
        elif op == "abs": values.append(abs(values.pop()))
        else:
            right, left = values.pop(), values.pop(); values.append(left + right if op == "add" else left * right)
    assert len(values) == 1
    return values[0]

def render(root):
    stack = [(root, False)]; values = []
    while stack:
        node, ready = stack.pop(); op = node["op"]
        if not ready:
            if op == "variable": values.append("x"); continue
            if op == "constant": values.append(f"({node['value']})"); continue
            stack.append((node, True))
            if op in ("negate", "abs", "square"): stack.append((node["arg"], False))
            else: stack.extend(((node["right"], False), (node["left"], False)))
            continue
        if op == "negate": values.append(f"(-{values.pop()})")
        elif op == "abs": values.append(f"abs({values.pop()})")
        elif op == "square": values.append(f"({values.pop()}^2)")
        else:
            right, left = values.pop(), values.pop(); values.append(f"({left}{'+' if op == 'add' else '*'}{right})")
    assert len(values) == 1
    return values[0]

def term_center(node):
    assert node["op"] == "abs"; inner = node["arg"]
    assert inner["op"] == "add" and inner["left"] == {"op":"variable"} and inner["right"]["op"] == "constant"
    return -Fraction(inner["right"]["value"])

def sum_centers(node):
    items = []
    while node["op"] == "add": items.append(term_center(node["right"])); node = node["left"]
    items.append(term_center(node)); return tuple(reversed(items))

def form_centers(expression, label):
    if label == "convex": return "sum-abs", sum_centers(expression)
    if label == "concave": assert expression["op"] == "negate"; return "negated-sum-abs", sum_centers(expression["arg"])
    assert expression["op"] == "multiply" and expression["left"] == {"op":"variable"}; return "x-times-sum-abs", sum_centers(expression["right"])

def check(case):
    ref, cert, label, depth = case["reference"], case["certificate"], case["label"], case["depth"]
    assert cert["policy"] == POLICY and ref["claimedLabel"] == label and ref["domain"] == {"min":"-1","max":"1"}
    measured_depth, nodes = shape(ref["expression"])
    expected = {"convex":5*depth-6, "concave":5*depth-10, "neither":5*depth-9}[label]
    assert depth in (256,512) and measured_depth == cert["depth"] == depth and nodes == cert["nodeCount"] == expected and nodes <= 2600
    form, centers = form_centers(ref["expression"], label); supplied = tuple(Fraction(x) for x in case["centers"])
    assert centers == supplied and len(centers) == cert["centerCount"] == (depth-1 if label == "convex" else depth-2)
    assert len(centers) == len(set(centers)) and all(Fraction(-1)<c<Fraction(1) for c in centers)
    if label == "convex": assert centers.count(Fraction(0)) == 1
    else: assert Fraction(0) not in centers and all(-c in centers for c in centers)
    witnesses=[]
    for pair in ref["witnessPairs"]:
        x,y=Fraction(pair["x"]),Fraction(pair["y"]); assert Fraction(-1) <= x <= Fraction(1) and Fraction(-1) <= y <= Fraction(1) and x != y; midpoint=(x+y)/2; fx,fy,fm=evaluate(ref["expression"],x),evaluate(ref["expression"],y),evaluate(ref["expression"],midpoint)
        witnesses.append({**pair,"midpoint":text(midpoint),"fX":text(fx),"fY":text(fy),"fMidpoint":text(fm),"gap":text(fm-(fx+fy)/2)})
    assert witnesses == cert["witnesses"] and render(ref["expression"]) == cert["renderedExpression"]
    gaps=[Fraction(w["gap"]) for w in witnesses]
    assert (label=="convex" and len(gaps)==1 and gaps[0]<0) or (label=="concave" and len(gaps)==1 and gaps[0]>0) or (label=="neither" and len(gaps)==2 and gaps[0]>0 and gaps[1]<0)
    assert case["standardVerifierOutcome"]["status"] == "unverified" and case["standardVerifierOutcome"]["reason"] == "resource-limit"
    identity="case-deep-pair-v1-"+str(depth)+"-"+hashlib.sha256(json.dumps(ref,separators=(",",":")).encode()).hexdigest(); assert case["id"] == identity
    ops={(256,"convex"):3448,(256,"concave"):3438,(256,"neither"):6113,(512,"convex"):6904,(512,"concave"):6894,(512,"neither"):12257}[(depth,label)]; assert cert["arithmeticOperations"]==ops
    canon=tuple(text(c) for c in centers)
    return {"id":case["id"],"depth":depth,"label":label,"domain":ref["domain"],"nodeCount":nodes,"form":form,"centerCount":len(centers),"canonicalCentersSha256":hashlib.sha256(json.dumps(canon,separators=(",",":")).encode()).hexdigest(),"witnesses":witnesses,"renderingSha256":hashlib.sha256(cert["renderedExpression"].encode()).hexdigest(),"arithmeticOperations":ops,"standardVerifierOutcome":{"status":"unverified","reason":"resource-limit"}},(depth,form,canon)

raw=SOURCE.read_bytes(); population=json.loads(raw)  # Deliberately relies on Python's default recursion limit.
assert population["researchPolicy"]==POLICY and len(population["cases"])==6
checked=[check(case) for case in population["cases"]]; cases, signatures=zip(*checked)
assert len(set(signatures))==6 and len({case["id"] for case in population["cases"]})==6
print(json.dumps({"suiteFileSha256":hashlib.sha256(raw).hexdigest(),"verdict":"pass","researchPolicy":POLICY,"limits":{"maximumDepth":512,"maximumNodeCount":2600,"rationalLiteralCharacters":96,"rationalBits":4096,"arithmeticOperations":200000,"standardVerifier":"unverified/resource-limit retained"},"cases":cases,"functionSignaturesUnique":True,"reviewer":"AI-assisted independent mathematical check","limitations":["This is an iterative stdlib exact-rational check of one fixed absolute-sum family, not a proof assistant or general verifier.","The standard verifier remains outside this admission path and is retained as unverified/resource-limit.","Associative nesting, string length, and kink count are confounded with depth; the six research tasks cannot support causal-depth, ranking, or general-model claims."]},indent=2))
