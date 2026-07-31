# DOM Evidence (AFTER FIX) - jdbranham-diagram-panel

Same three TestData series (`Orders=120`, `Payments=95`, `Shipping=78`) on both panels.

- CONTROL flowchart still binds values: **YES**
- SEQUENCE now binds values (no render error): **YES - fixed**

## Panel: Flowchart - nodes AND edges bind data  [kind: flowchart]

| metric | value |
| --- | --- |
| diagram svg rendered | true |
| render error shown | false |
| `.diagram-value` count | **5** |
| `.diagram-value` samples | ["42","17","Orders 120","Payments 95","Shipping 78"] |
| injected numbers (120/95/78) in diagram svg | ["120","95","78"] |

## Panel: Sequence - actors AND messages bind data (fixed)  [kind: sequence]

| metric | value |
| --- | --- |
| diagram svg rendered | true |
| render error shown | false |
| `.diagram-value` count | **8** |
| `.diagram-value` samples | ["78","95","120","78","95","120","42","17"] |
| injected numbers (120/95/78) in diagram svg | ["120","95","78"] |

_No browser console errors observed._
