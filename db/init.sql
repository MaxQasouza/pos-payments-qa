-- =============================================================================
-- Banco da Payments API (POS). Idempotente: pode ser executado mais de uma vez.
-- Executado por "npm run db:init" (Node + mssql, sem depender de sqlcmd).
-- =============================================================================
IF DB_ID(N'PosPayments') IS NULL
    CREATE DATABASE PosPayments;
GO

USE PosPayments;
GO

IF OBJECT_ID(N'dbo.Transactions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Transactions (
        Id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Transactions PRIMARY KEY,
        IdempotencyKey    NVARCHAR(100)    NOT NULL,
        RequestHash       CHAR(64)         NOT NULL, -- sha256 do pedido: detecta key repetida com body diferente
        Amount            INT              NOT NULL CONSTRAINT CK_Transactions_Amount CHECK (Amount > 0 AND Amount <= 10000000),
        Method            VARCHAR(10)      NOT NULL CONSTRAINT CK_Transactions_Method CHECK (Method IN ('credit', 'debit', 'pix')),
        Installments      TINYINT          NOT NULL CONSTRAINT CK_Transactions_Installments CHECK (Installments BETWEEN 1 AND 12),
        Status            VARCHAR(10)      NOT NULL CONSTRAINT CK_Transactions_Status CHECK (Status IN ('pending', 'approved', 'declined', 'cancelled')),
        AuthorizationCode CHAR(6)          NULL,
        CreatedAt         DATETIME2(7)     NOT NULL CONSTRAINT DF_Transactions_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt         DATETIME2(7)     NOT NULL CONSTRAINT DF_Transactions_UpdatedAt DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Índice ÚNICO em IdempotencyKey: SEGUNDA CAMADA DE DEFESA contra cobrança duplicada.
-- A primeira camada é a verificação na aplicação. Se ela falhar (bug, deploy errado,
-- duas requisições simultâneas), o banco recusa a segunda linha com a mesma key.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Transactions_IdempotencyKey'
               AND object_id = OBJECT_ID(N'dbo.Transactions'))
    CREATE UNIQUE INDEX UX_Transactions_IdempotencyKey ON dbo.Transactions (IdempotencyKey);
GO
