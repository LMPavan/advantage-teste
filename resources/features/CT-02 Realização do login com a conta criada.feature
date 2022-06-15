##Author: lucca.lpavan@gmail.com

@login @all
Feature: Realizar login
  Eu como usuario gostaria de realizar login no site da Advantage

  Scenario: Realizar logout
    Given eu esteja na pagina devidamente logado
    When eu clicar em user na pagina logado
    And clicar em sign out
    Then estarei deslogado
    
  Scenario: Realizar login
    Given eu esteja na pagina inicial deslogado
    When eu clicar em user na pagina deslogado
    And preencher meu username
    And preencher meu password
    And clicar no botao sign in
    Then login sera realizado
