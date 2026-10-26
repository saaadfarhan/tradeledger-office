package com.purchasesale.domain;

public final class ChequeStatusChange {
    private final String chequeNumber;
    private final String status;
    private final String changedAt;

    public ChequeStatusChange(String chequeNumber, String status, String changedAt) {
        this.chequeNumber = chequeNumber;
        this.status = status;
        this.changedAt = changedAt;
    }
    public String getChequeNumber() { return chequeNumber; }
    public String getStatus() { return status; }
    public String getChangedAt() { return changedAt; }
}
