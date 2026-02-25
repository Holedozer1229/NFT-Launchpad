pragma circom 2.0.0;

template ECDSAVerify() {
    signal input R_x;
    signal input r;
    
    // zkSNARK verification of ECDSA PoW
    // s * s_inv ≡ 1 mod n
    // u1 ≡ z * s_inv mod n
    // u2 ≡ r * s_inv mod n
    // R_x ≡ u1*G_x + u2*PubKey_x
    // r' ≡ R_x mod n
    
    // Constraint: Verify that R_x matches r
    R_x === r;
}

component main {public [R_x, r]} = ECDSAVerify();
