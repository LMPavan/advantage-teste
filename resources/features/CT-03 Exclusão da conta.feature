#Author: your.email@your.domain.com

@excluir @all
Feature: Excluir conta
  Eu como usuario gostaria de excluir minha conta no site da Advantage


  Scenario: ir para o my account
    Given eu esteja na pagina inicial devidamente logado
    When eu clicar no botao user
    And clicar no botao my account
    Then eu irei para a pagina do my account
    
   Scenario: excluir conta 
    Given eu esteja na pagina do my account
    When eu clicar no botao delete account
    And clicar em yes
    Then validamos a mensagem
