package advantage.page.steps;

import java.io.IOException;

import advantage.page.pages.CadastroUsuarioPage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

public class CadastroTeste {
	
	CadastroUsuarioPage addUsuario = new CadastroUsuarioPage();

	// Ir para pagina de cadastro

	@Given("eu esteja na pagina inicial")
	public void euEstejaNaPaginaInicial() {
	}

	@When("eu clicar no icone user")
	public void euClicarNoIconeUser() throws InterruptedException {
		addUsuario.esperarCarregamentoSlow();
		addUsuario.clicarUser();
	}

	@When("clicar em create new account no pagina que abrir")
	public void clicarEmCreateNewAccountNoPaginaQueAbrir() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.clicarCreateAccount();
	}

	@Then("eu serei direcionado para a pagina de cadastro")
	public void euSereiDirecionadoParaAPaginaDeCadastro() {
	}

	// Cadastrar usuario

	@Given("eu esteja na pagina de cadastro")
	public void euEstejaNaPaginaDeCadastro() {
	}

	@When("eu preencher meu username")
	public void euPreencherMeuUsername() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.preencherUsername();
		
	}

	@When("preencher o meu e-mail")
	public void preencherOMeuEMail() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.preencherEmail();
	}

	@When("preencher minha senha")
	public void preencherMinhaSenha() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.preencherPassword();
	}

	@When("preencher a confirmacao de senha")
	public void preencherAConfirmacaoDeSenha() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.preencherConfirmPassword();
	}

	@When("preencher meu primeiro nome")
	public void preencherMeuPrimeiroNome() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.preencherFirstName();
	}

	@When("preencher meu ultimo nome")
	public void preencherMeuUltimoNome() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.preencherLastName();
	}

	@When("preencher meu numero de celular")
	public void preencherMeuNumeroDeCelular() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.preencherPhoneNumber();
	}

	@When("selecionar meu pais")
	public void selecionarMeuPais() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.SelecionarCountry();
	}

	@When("preencher minha cidade")
	public void preencherMinhaCidade() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.preencherCity();
	}

	@When("preencher meu endereco")
	public void preencherMeuEndereco() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.preencherAdress();
	}

	@When("preencher meu estado")
	public void preencherMeuEstado() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.preencherState();
	}

	@When("preencher meu cep")
	public void preencherMeuCep() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.preencherPostalCode();
	}

	@When("selecionar que estou de acordo com as codicoes de uso")
	public void selecionarQueEstouDeAcordoComAsCodicoesDeUso() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.clicarIAgree();
	}

	@When("clicar no botao de registrar")
	public void clicarNoBotaoDeRegistrar() throws InterruptedException {
		addUsuario.esperarCarregamentoFast();
		addUsuario.clicarRegister();
	}

	@Then("cadastro realizado e estaremos logado")
	public void cadastroRealizadoEEstaremosLogado() {
	}




}
