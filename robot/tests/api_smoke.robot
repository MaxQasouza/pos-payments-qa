*** Settings ***
Documentation       Smoke da Payments API em Robot Framework (RequestsLibrary).
...                 Pré-requisito: mock do autorizador e API rodando (npm run dev).
...                 Para outro ambiente: python -m robot --variable BASE_URL:http://host:3000 robot/tests
Library             RequestsLibrary
Library             Collections
Suite Setup         Create Session    api    ${BASE_URL}    disable_warnings=1

*** Variables ***
${BASE_URL}         http://localhost:3000

*** Test Cases ***
POS-100 Health check da API deve responder ok
    [Tags]    smoke    POS-100
    ${resp}=    GET On Session    api    /health    expected_status=200
    Should Be Equal    ${resp.json()}[status]    ok

POS-101 Venda no débito deve ser aprovada
    [Tags]    smoke    venda    POS-101
    ${resp}=    Criar Venda    ${1500}    debit    expected_status=201
    Should Be Equal    ${resp.json()}[status]    approved
    Should Match Regexp    ${resp.json()}[authorizationCode]    ^\\d{6}$

POS-102 Valor inválido deve retornar 422
    [Tags]    validacao    POS-102
    ${resp}=    Criar Venda    ${0}    debit    expected_status=422
    Should Be Equal    ${resp.json()}[error]    INVALID_AMOUNT

POS-103 Idempotência: mesma key duas vezes retorna o mesmo id
    [Tags]    smoke    idempotencia    POS-103
    ${key}=     Nova Idempotency Key
    ${primeira}=    Criar Venda    ${2500}    debit    key=${key}    expected_status=201
    ${segunda}=     Criar Venda    ${2500}    debit    key=${key}    expected_status=200
    Should Be Equal    ${primeira.json()}[id]    ${segunda.json()}[id]
    ${lista}=    GET On Session    api    /transactions    params=idempotencyKey=${key}    expected_status=200
    Length Should Be    ${lista.json()}    1

POS-104 Cancelamento de venda aprovada
    [Tags]    smoke    cancelamento    POS-104
    ${venda}=    Criar Venda    ${3000}    credit    installments=${2}    expected_status=201
    ${id}=       Set Variable    ${venda.json()}[id]
    ${resp}=     POST On Session    api    /transactions/${id}/cancel    expected_status=200
    Should Be Equal    ${resp.json()}[status]    cancelled

*** Keywords ***
Nova Idempotency Key
    ${uuid}=    Evaluate    str(uuid.uuid4())    modules=uuid
    RETURN    robot-${uuid}

Criar Venda
    [Arguments]    ${amount}    ${method}    ${installments}=${NONE}    ${key}=${NONE}    ${expected_status}=any
    IF    $key is None
        ${key}=    Nova Idempotency Key
    END
    ${body}=    Create Dictionary    amount=${amount}    method=${method}
    IF    $installments is not None
        Set To Dictionary    ${body}    installments=${installments}
    END
    ${headers}=    Create Dictionary    Idempotency-Key=${key}
    ${resp}=    POST On Session    api    /transactions    json=${body}    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${resp}
