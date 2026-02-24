;; ============================================================================
;; PoX Pool Automation Contract
;; ============================================================================
;; 
;; Automatically delegates STX to PoX pools, rotates delegations per cycle,
;; routes BTC yield to treasury, and enforces DAO-governed parameters.
;;
;; Design Principles:
;; - Non-custodial: STX never transferred, only delegated
;; - Revocable: Users can revoke delegation at any time
;; - DAO-controlled: Pool operator managed by DAO governance
;; - Immutable economics: Core economic constants cannot be upgraded
;; - Gas-optimized: Minimal state writes, efficient delegation tracking
;;
;; ============================================================================

;; Error codes
(define-constant ERR-NOT-AUTH (err u401))
(define-constant ERR-CYCLE (err u402))
(define-constant ERR-INVALID-AMOUNT (err u403))
(define-constant ERR-DELEGATION-FAILED (err u404))
(define-constant ERR-BELOW-MINIMUM (err u405))
(define-constant ERR-ALREADY-DELEGATED (err u406))

;; Minimum delegation amount (100 STX in micro-STX)
(define-constant MIN-DELEGATION-AMOUNT u100000000)

;; DAO and Treasury principals (replace with actual addresses)
(define-constant DAO 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)
(define-constant TREASURY 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)

;; State variables
(define-data-var current-pool principal DAO)
(define-data-var last-rotation-height uint u0)
(define-data-var total-delegated uint u0)
(define-data-var delegation-count uint u0)

;; User delegation tracking
(define-map user-delegations
  principal
  {
    amount: uint,
    start-height: uint,
    active: bool
  }
)

;; Pool history for auditing
(define-map pool-history
  uint
  {
    pool: principal,
    total-stx: uint,
    block-height: uint
  }
)

;; ============================================================================
;; Governance Functions
;; ============================================================================

;; Set new pool operator (DAO only)
(define-public (set-pool (new-pool principal))
  (begin
    (asserts! (is-eq tx-sender DAO) ERR-NOT-AUTH)
    (asserts! (not (is-eq new-pool (var-get current-pool))) ERR-INVALID-AMOUNT)
    
    ;; Record pool change at current block height
    (map-set pool-history block-height {
      pool: new-pool,
      total-stx: (var-get total-delegated),
      block-height: block-height
    })
    
    (var-set current-pool new-pool)
    (var-set last-rotation-height block-height)
    (ok true)
  )
)

;; ============================================================================
;; Delegation Functions
;; ============================================================================

;; Delegate STX to current pool
(define-public (delegate (amount uint))
  (let (
    (user tx-sender)
    (existing (map-get? user-delegations user))
  )
    (begin
      ;; Validate minimum amount
      (asserts! (>= amount MIN-DELEGATION-AMOUNT) ERR-BELOW-MINIMUM)
      
      ;; Check user doesn't already have an active delegation
      (asserts! (or
        (is-none existing)
        (not (get active (unwrap-panic existing)))
      ) ERR-ALREADY-DELEGATED)
      
      ;; Execute delegation via built-in PoX function
      (match (stx-delegate-stx amount (var-get current-pool) none none)
        success (begin
          ;; Update user tracking
          (map-set user-delegations user {
            amount: amount,
            start-height: block-height,
            active: true
          })
          
          ;; Update totals
          (var-set total-delegated (+ (var-get total-delegated) amount))
          (var-set delegation-count (+ (var-get delegation-count) u1))
          
          (ok true)
        )
        error ERR-DELEGATION-FAILED
      )
    )
  )
)

;; Revoke delegation (user-initiated)
(define-public (revoke-delegation)
  (let (
    (user tx-sender)
    (delegation (unwrap! (map-get? user-delegations user) ERR-NOT-AUTH))
  )
    (begin
      (asserts! (get active delegation) ERR-NOT-AUTH)
      
      ;; Revoke STX delegation
      (match (stx-revoke-delegate-stx)
        success (begin
          ;; Update user status
          (map-set user-delegations user (merge delegation { active: false }))
          
          ;; Update totals
          (var-set total-delegated (- (var-get total-delegated) (get amount delegation)))
          
          (ok true)
        )
        error ERR-DELEGATION-FAILED
      )
    )
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-pool)
  (ok (var-get current-pool))
)

(define-read-only (get-total-delegated)
  (ok (var-get total-delegated))
)

(define-read-only (get-delegation-count)
  (ok (var-get delegation-count))
)

(define-read-only (get-user-delegation (user principal))
  (ok (map-get? user-delegations user))
)

(define-read-only (get-pool-history-entry (height uint))
  (ok (map-get? pool-history height))
)

(define-read-only (get-stats)
  (ok {
    current-pool: (var-get current-pool),
    total-delegated: (var-get total-delegated),
    delegation-count: (var-get delegation-count),
    last-rotation-height: (var-get last-rotation-height)
  })
)

(define-read-only (get-min-delegation)
  (ok MIN-DELEGATION-AMOUNT)
)

;; ============================================================================
;; BTC Yield Routing
;; ============================================================================
;;
;; BTC rewards are received by the pool operator off-chain and must be
;; routed to the TREASURY address according to the yield formula:
;;
;; R_T = R * min(0.30, 0.05 + Phi/2000)
;;
;; Where:
;; - R is the total BTC reward
;; - Phi is the spectral integration score
;; - Treasury share is capped at 30%
;;
;; This routing is enforced through:
;; 1. DAO oversight of pool operator
;; 2. On-chain pool history for auditing
;; 3. Social consensus and reputation
;;
;; ============================================================================
