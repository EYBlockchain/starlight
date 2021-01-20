Indicators – how to decide...

GLOBAL SCOPE

newCommitmentsRequired:
- Declaration of a `secret` stateVariable.

oldCommitmentAccessRequired:
- If nullifiersRequired === ‘true’.
- A secret state appears (on the RHS of an argument? In any statement? In a binary operator?)

nullifiersRequired:
- If initialisationRequired === ‘true’.
- An accumulating secret state is edited?
- An incremental state is decremented.

zkSnarkVerificationRequired:
- ???? set to ‘true’ always for now.

FUNCTION SCOPE

newCommitmentsRequired:
- A secret state on the LHS of a `=, +=, -=, \*=, /=, %=`, operator.

oldCommitmentAccessRequired:
- If nullifiersRequired === ‘true’.
- A secret state is ‘referred to’. I.e. is on the RHS of an expression/assignment? Is in any statement? Is in a binary operator?

nullifiersRequired:
- If initialisationRequired === ‘true’.
- An accumulating secret state is edited?
- An incremental state is decremented.

initialisationRequired (per secret state being edited in the func)

zkSnarkVerificationRequired:
- If a secret state or secret parameter is used in the function?


SECRET STATE INDICATORS:

secretVariable:from initial parsing of the zsol contract.

incrementingOrAccumulating:
- Difficult, but important...Maybe, if some non-owner is permitted to increment the secret state (somewhere in the contract), then it must be `incrementing`; otherwise it can be `accumulating`.

SECRET STATE EDITS:

initialisationRequired:
- If an accumulating secret state may be edited more than once.
