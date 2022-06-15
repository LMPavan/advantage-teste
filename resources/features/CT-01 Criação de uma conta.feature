#Author: lucca.lpavan@gmail.com

@cadastro @all
Feature: Realizar cadastro
  Eu como usuario gostaria de realizar um cadastro no site da Advantage


  Scenario: Ir para pagina de cadastro
    Given eu esteja na pagina inicial
    When eu clicar no icone user
    And clicar em create new account no pagina que abrir
    Then eu serei direcionado para a pagina de cadastro
    
   Scenario: Cadastrar usuario	
    Given eu esteja na pagina de cadastro
    When eu preencher meu username
    And preencher o meu e-mail
    And preencher minha senha
    And preencher a confirmacao de senha
    And preencher meu primeiro nome
    And preencher meu ultimo nome
    And preencher meu numero de celular
    And selecionar meu pais
    And preencher minha cidade
    And preencher meu endereco
    And preencher meu estado
    And preencher meu cep
    And selecionar que estou de acordo com as codicoes de uso
    And clicar no botao de registrar
    Then cadastro realizado e estaremos logado
